// mdld-convert — Gateway between MD-LD and standard RDF formats
// Uses N3.js for Turtle/TriG/N-Triples/N-Quads parsing and serialization
// Uses jsonld.js for JSON-LD parsing and serialization
// Uses rdfa-parse for RDFa 1.1 Core parsing
// Uses mdld-parse for MD-LD parsing and generation

import { Parser, Writer, DataFactory } from 'n3'
import jsonld from 'jsonld'
import { parseRDFa } from 'rdfa-parse'
import { parse, generate } from 'mdld-parse'

// ═══════════════════════════════════════════════════════════════════════════════
// Import: External RDF Formats → MD-LD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert Turtle to MD-LD
 * @param {string} turtle - Turtle text
 * @returns {string} MD-LD text
 */
export const fromTurtle = (turtle) => {
    const parser = new Parser({ format: 'text/turtle' })
    const quads = parser.parse(turtle)
    const { text } = generate({ quads })
    return text
}

/**
 * Convert Turtle to MD-LD with context preservation
 * @param {string} turtle - Turtle text
 * @returns {Promise<{ text: string, context: object }>} MD-LD text and context
 */
export const fromTurtleWithContext = async (turtle) => {
    const parser = new Parser({ format: 'text/turtle' })
    let prefixes = {}
    const quads = []

    await new Promise((resolve, reject) => {
        parser.parse(turtle, (err, quad, pref) => {
            if (err) {
                reject(err)
            } else if (quad) {
                quads.push(quad)
            } else {
                // quad is null, parsing complete
                if (pref) prefixes = pref
                resolve()
            }
        })
    })

    const { text, context } = generate({ quads, context: prefixes })
    return { text, context }
}

/**
 * Convert TriG to MD-LD
 * @param {string} trig - TriG text
 * @returns {string} MD-LD text
 */
export const fromTriG = (trig) => {
    const parser = new Parser({ format: 'application/trig' })
    const quads = parser.parse(trig)
    const { text } = generate({ quads })
    return text
}

/**
 * Convert TriG to MD-LD with context preservation
 * @param {string} trig - TriG text
 * @returns {Promise<{ text: string, context: object }>} MD-LD text and context
 */
export const fromTriGWithContext = async (trig) => {
    const parser = new Parser({ format: 'application/trig' })
    let prefixes = {}
    const quads = []

    await new Promise((resolve, reject) => {
        parser.parse(trig, (err, quad, pref) => {
            if (err) {
                reject(err)
            } else if (quad) {
                quads.push(quad)
            } else {
                // quad is null, parsing complete
                if (pref) prefixes = pref
                resolve()
            }
        })
    })

    const { text, context } = generate({ quads, context: prefixes })
    return { text, context }
}

/**
 * Convert N-Triples to MD-LD
 * @param {string} nt - N-Triples text
 * @returns {string} MD-LD text
 */
export const fromNTriples = (nt) => {
    const parser = new Parser({ format: 'application/n-triples' })
    const quads = parser.parse(nt)
    const { text } = generate({ quads })
    return text
}

/**
 * Convert N-Quads to MD-LD
 * @param {string} nq - N-Quads text
 * @returns {string} MD-LD text
 */
export const fromNQuads = (nq) => {
    const parser = new Parser({ format: 'application/n-quads' })
    const quads = parser.parse(nq)
    const { text } = generate({ quads })
    return text
}

/**
 * Auto-detect format and convert to MD-LD
 * @param {string} text - RDF text (Turtle, TriG, N-Triples, or N-Quads)
 * @param {string} [format] - Optional format hint ('turtle', 'trig', 'nt', 'nq')
 * @returns {string} MD-LD text
 */
export const fromRDF = (text, format) => {
    if (format) {
        switch (format.toLowerCase()) {
            case 'turtle': return fromTurtle(text)
            case 'trig': return fromTriG(text)
            case 'nt': return fromNTriples(text)
            case 'nq': return fromNQuads(text)
            default: throw new Error(`Unknown format: ${format}`)
        }
    }

    // Auto-detect based on content
    if (text.includes('@prefix') || text.includes('@base') || text.includes('a ')) {
        return fromTurtle(text)
    }
    if (text.includes('{') && text.includes('}')) {
        return fromTriG(text)
    }
    if (/^<[^>]+>\s+<[^>]+>\s+/.test(text)) {
        return fromNTriples(text)
    }
    if (/^<[^>]+>\s+<[^>]+>\s+<[^>]+>\s+/.test(text)) {
        return fromNQuads(text)
    }

    // Default to Turtle
    return fromTurtle(text)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Import: JSON-LD → MD-LD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert JSON-LD to MD-LD
 * @param {string|object} jsonld - JSON-LD string or object
 * @returns {Promise<string>} MD-LD text
 */
export const fromJSONLD = async (jsonldInput) => {
    const doc = typeof jsonldInput === 'string' ? JSON.parse(jsonldInput) : jsonldInput
    const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' })
    return fromNQuads(nquads)
}

/**
 * Convert JSON-LD to MD-LD with context preservation
 * @param {string|object} jsonld - JSON-LD string or object
 * @returns {Promise<{ text: string, context: object }>} MD-LD text and context
 */
export const fromJSONLDWithContext = async (jsonldInput) => {
    const doc = typeof jsonldInput === 'string' ? JSON.parse(jsonldInput) : jsonldInput
    const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' })
    const quads = new Parser({ format: 'application/n-quads' }).parse(nquads)

    // Extract @context from JSON-LD and convert to MD-LD prefix format
    const jsonldContext = doc['@context'] || {}
    const prefixes = {}

    if (typeof jsonldContext === 'object' && !Array.isArray(jsonldContext)) {
        for (const [key, value] of Object.entries(jsonldContext)) {
            if (typeof value === 'string' && value.endsWith('/') || value.endsWith('#')) {
                prefixes[key] = value
            }
        }
    }

    const { text, context } = generate({ quads, context: prefixes })
    return { text, context }
}

/**
 * Convert RDFa 1.1 HTML to MD-LD
 * @param {string} html - HTML text with RDFa markup
 * @param {object} [options] - RDFa parsing options (baseIRI, vocab, language, profile)
 * @returns {string} MD-LD text
 */
export const fromRDFa = (html, options = {}) => {
    const quads = parseRDFa(html, {
        dataFactory: DataFactory,
        ...options
    })
    const { text } = generate({ quads })
    return text
}

/**
 * Convert RDFa 1.1 HTML to MD-LD with context preservation
 * @param {string} html - HTML text with RDFa markup
 * @param {object} [options] - RDFa parsing options (baseIRI, vocab, language, profile)
 * @returns {{ text: string, context: object }} MD-LD text and context
 */
export const fromRDFaWithContext = (html, options = {}) => {
    const quads = parseRDFa(html, {
        dataFactory: DataFactory,
        ...options
    })

    // Extract @vocab as default prefix
    const prefixes = {}
    const vocab = options.vocab || ''

    if (vocab) {
        prefixes[''] = vocab
    }

    const { text, context } = generate({ quads, context: prefixes })
    return { text, context }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export: MD-LD → External RDF Formats
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert MD-LD to Turtle
 * @param {string} mdld - MD-LD text
 * @param {object} [options] - Writer options (e.g., prefixes)
 * @returns {Promise<string>} Turtle text
 */
export const toTurtle = (mdld, options = {}) => {
    const { quads, context } = parse(mdld)
    const writer = new Writer({ format: 'text/turtle', prefixes: context, ...options })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

/**
 * Convert MD-LD to Turtle with context preservation
 * @param {string} mdld - MD-LD text
 * @param {object} [options] - Writer options
 * @returns {Promise<{ text: string, context: object }>} Turtle text and context
 */
export const toTurtleWithContext = async (mdld, options = {}) => {
    const { quads, context } = parse(mdld)
    const writer = new Writer({ format: 'text/turtle', prefixes: context, ...options })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve({ text: result, context })
        })
    })
}

/**
 * Convert MD-LD to TriG
 * @param {string} mdld - MD-LD text
 * @param {object} [options] - Writer options (e.g., prefixes)
 * @returns {Promise<string>} TriG text
 */
export const toTriG = (mdld, options = {}) => {
    const { quads, context } = parse(mdld)
    const writer = new Writer({ format: 'application/trig', prefixes: context, ...options })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

/**
 * Convert MD-LD to TriG with context preservation
 * @param {string} mdld - MD-LD text
 * @param {object} [options] - Writer options
 * @returns {Promise<{ text: string, context: object }>} TriG text and context
 */
export const toTriGWithContext = async (mdld, options = {}) => {
    const { quads, context } = parse(mdld)
    const writer = new Writer({ format: 'application/trig', prefixes: context, ...options })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve({ text: result, context })
        })
    })
}

/**
 * Convert MD-LD to N-Triples
 * @param {string} mdld - MD-LD text
 * @returns {Promise<string>} N-Triples text
 */
export const toNTriples = (mdld) => {
    const { quads } = parse(mdld)
    const writer = new Writer({ format: 'application/n-triples' })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

/**
 * Convert MD-LD to N-Quads
 * @param {string} mdld - MD-LD text
 * @returns {Promise<string>} N-Quads text
 */
export const toNQuads = (mdld) => {
    const { quads } = parse(mdld)
    const writer = new Writer({ format: 'application/n-quads' })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

/**
 * Convert MD-LD to specified RDF format
 * @param {string} mdld - MD-LD text
 * @param {string} format - Target format ('turtle', 'trig', 'nt', 'nq')
 * @param {object} [options] - Writer options
 * @returns {Promise<string>} RDF text
 */
export const toRDF = (mdld, format, options = {}) => {
    switch (format.toLowerCase()) {
        case 'turtle': return toTurtle(mdld, options)
        case 'trig': return toTriG(mdld, options)
        case 'nt': return toNTriples(mdld)
        case 'nq': return toNQuads(mdld)
        default: throw new Error(`Unknown format: ${format}`)
    }
}

/**
 * Convert MD-LD to JSON-LD
 * @param {string} mdld - MD-LD text
 * @param {object} [options] - JSON-LD options (e.g., context)
 * @returns {Promise<object>} JSON-LD object
 */
export const toJSONLD = async (mdld, options = {}) => {
    const nquads = await toNQuads(mdld)
    return jsonld.fromRDF(nquads, { format: 'application/n-quads', ...options })
}