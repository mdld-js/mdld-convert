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
// Core API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Universal conversion between RDF formats
 * @param {object} params - Conversion parameters
 * @param {string|object} params.input - Input text or object (JSON-LD)
 * @param {string} params.from - Source format: 'turtle', 'trig', 'nt', 'nq', 'jsonld', 'rdfa', 'mdld', 'quads'
 * @param {string} params.to - Target format: 'turtle', 'trig', 'nt', 'nq', 'jsonld', 'mdld', 'quads'
 * @param {object} [params.context] - Prefix mappings for output
 * @param {string} [params.baseIRI] - Base IRI for RDFa/JSON-LD
 * @param {string} [params.vocab] - Vocabulary IRI for RDFa
 * @param {boolean} [params.returnQuads] - Return { quads, text } instead of just text
 * @returns {Promise<string|{ quads: Array, text: string }>} Converted text or quads
 */
export const convert = async ({ input, from, to, context, baseIRI, vocab, returnQuads }) => {
    // Parse input to quads
    let quads
    let inputContext = {}

    switch (from) {
        case 'turtle':
            quads = await parseTurtleToQuads(input)
            inputContext = await extractTurtleContext(input)
            break
        case 'trig':
            quads = await parseTriGToQuads(input)
            inputContext = await extractTriGContext(input)
            break
        case 'nt':
            quads = parseNTriplesToQuads(input)
            break
        case 'nq':
            quads = parseNQuadsToQuads(input)
            break
        case 'jsonld':
            quads = await parseJSONLDToQuads(input)
            inputContext = extractJSONLDContext(input)
            break
        case 'rdfa':
            quads = parseRDFaToQuads(input, { baseIRI, vocab })
            inputContext = vocab ? { '': vocab } : {}
            break
        case 'mdld':
            const parsed = parse(input)
            quads = parsed.quads
            inputContext = parsed.context
            break
        case 'quads':
            quads = jsonToQuads(input)
            inputContext = {} // Quads don't have context
            break
        default:
            throw new Error(`Unknown source format: ${from}`)
    }

    // Merge contexts: user-provided context takes precedence
    const outputContext = { ...inputContext, ...context }

    // Convert quads to target format
    let result
    switch (to) {
        case 'turtle':
            result = await serializeQuadsToTurtle(quads, outputContext)
            break
        case 'trig':
            result = await serializeQuadsToTriG(quads, outputContext)
            break
        case 'nt':
            result = await serializeQuadsToNTriples(quads)
            break
        case 'nq':
            result = await serializeQuadsToNQuads(quads)
            break
        case 'jsonld':
            result = await serializeQuadsToJSONLD(quads, outputContext)
            break
        case 'mdld':
            const generated = generate({ quads, context: outputContext })
            result = generated.text
            break
        case 'quads':
            result = quadsToJSON(quads)
            break
        default:
            throw new Error(`Unknown target format: ${to}`)
    }

    return returnQuads ? { quads, text: result } : result
}

/**
 * Serialize quads to JSON
 * @param {Array} quads - RDFJS Quad array
 * @returns {string} JSON string
 */
export const quadsToJSON = (quads) => {
    return JSON.stringify(quads.map(quad => ({
        subject: quad.subject.value,
        predicate: quad.predicate.value,
        object: quad.object.value,
        graph: quad.graph.value,
        subjectType: quad.subject.termType,
        predicateType: quad.predicate.termType,
        objectType: quad.object.termType,
        graphType: quad.graph.termType,
        datatype: quad.object.datatype?.value,
        language: quad.object.language
    })))
}

/**
 * Deserialize JSON to quads
 * @param {string} json - JSON string
 * @returns {Array} RDFJS Quad array
 */
export const jsonToQuads = (json) => {
    const data = JSON.parse(json)
    return data.map(q => DataFactory.quad(
        q.subjectType === 'NamedNode' ? DataFactory.namedNode(q.subject) : DataFactory.blankNode(q.subject),
        DataFactory.namedNode(q.predicate),
        q.objectType === 'NamedNode' ? DataFactory.namedNode(q.object) :
            q.objectType === 'Literal' ? DataFactory.literal(q.object, q.language || q.datatype) :
                DataFactory.blankNode(q.object),
        q.graphType === 'NamedNode' ? DataFactory.namedNode(q.graph) : DataFactory.defaultGraph()
    ))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

// Parse functions
const parseTurtleToQuads = async (turtle) => {
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
                if (pref) prefixes = pref
                resolve()
            }
        })
    })

    return quads
}

const parseTriGToQuads = async (trig) => {
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
                if (pref) prefixes = pref
                resolve()
            }
        })
    })

    return quads
}

const parseNTriplesToQuads = (nt) => {
    const parser = new Parser({ format: 'application/n-triples' })
    return parser.parse(nt)
}

const parseNQuadsToQuads = (nq) => {
    const parser = new Parser({ format: 'application/n-quads' })
    return parser.parse(nq)
}

const parseJSONLDToQuads = async (jsonldInput) => {
    const doc = typeof jsonldInput === 'string' ? JSON.parse(jsonldInput) : jsonldInput
    const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' })
    return parseNQuadsToQuads(nquads)
}

const parseRDFaToQuads = (html, options = {}) => {
    return parseRDFa(html, {
        dataFactory: DataFactory,
        ...options
    })
}

// Context extraction functions
const extractTurtleContext = async (turtle) => {
    const parser = new Parser({ format: 'text/turtle' })
    let prefixes = {}

    await new Promise((resolve, reject) => {
        parser.parse(turtle, (err, quad, pref) => {
            if (err) {
                reject(err)
            } else if (quad) {
                // continue
            } else {
                if (pref) prefixes = pref
                resolve()
            }
        })
    })

    return prefixes
}

const extractTriGContext = async (trig) => {
    const parser = new Parser({ format: 'application/trig' })
    let prefixes = {}

    await new Promise((resolve, reject) => {
        parser.parse(trig, (err, quad, pref) => {
            if (err) {
                reject(err)
            } else if (quad) {
                // continue
            } else {
                if (pref) prefixes = pref
                resolve()
            }
        })
    })

    return prefixes
}

const extractJSONLDContext = (jsonldInput) => {
    const doc = typeof jsonldInput === 'string' ? JSON.parse(jsonldInput) : jsonldInput
    const context = doc['@context'] || {}
    const prefixes = {}

    if (typeof context === 'object') {
        for (const [key, value] of Object.entries(context)) {
            if (typeof value === 'string' && value.startsWith('http')) {
                prefixes[key] = value
            }
        }
    }

    return prefixes
}

// Serialize functions
const serializeQuadsToTurtle = async (quads, context = {}) => {
    const writer = new Writer({ format: 'text/turtle', prefixes: context })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

const serializeQuadsToTriG = async (quads, context = {}) => {
    const writer = new Writer({ format: 'application/trig', prefixes: context })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

const serializeQuadsToNTriples = async (quads) => {
    const writer = new Writer({ format: 'application/n-triples' })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

const serializeQuadsToNQuads = async (quads) => {
    const writer = new Writer({ format: 'application/n-quads' })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

const serializeQuadsToJSONLD = async (quads, context = {}) => {
    const nquads = await serializeQuadsToNQuads(quads)
    const jsonldResult = await jsonld.fromRDF(nquads)

    // Add context if provided
    if (Object.keys(context).length > 0) {
        if (Array.isArray(jsonldResult)) {
            jsonldResult.forEach(item => {
                item['@context'] = context
            })
        } else {
            jsonldResult['@context'] = context
        }
    }

    return jsonldResult
}

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
// Quad-Target Conversions (RDF ↔ Quads, skip MD-LD)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert Turtle to Quads
 * @param {string} turtle - Turtle text
 * @returns {Array} RDFJS Quad array
 */
export const fromTurtleToQuads = (turtle) => {
    const parser = new Parser({ format: 'text/turtle' })
    return parser.parse(turtle)
}

/**
 * Convert TriG to Quads
 * @param {string} trig - TriG text
 * @returns {Array} RDFJS Quad array
 */
export const fromTriGToQuads = (trig) => {
    const parser = new Parser({ format: 'application/trig' })
    return parser.parse(trig)
}

/**
 * Convert N-Triples to Quads
 * @param {string} nt - N-Triples text
 * @returns {Array} RDFJS Quad array
 */
export const fromNTriplesToQuads = (nt) => {
    const parser = new Parser({ format: 'application/n-triples' })
    return parser.parse(nt)
}

/**
 * Convert N-Quads to Quads
 * @param {string} nq - N-Quads text
 * @returns {Array} RDFJS Quad array
 */
export const fromNQuadsToQuads = (nq) => {
    const parser = new Parser({ format: 'application/n-quads' })
    return parser.parse(nq)
}

/**
 * Convert JSON-LD to Quads
 * @param {string|object} jsonld - JSON-LD string or object
 * @returns {Promise<Array>} RDFJS Quad array
 */
export const fromJSONLDToQuads = async (jsonldInput) => {
    const doc = typeof jsonldInput === 'string' ? JSON.parse(jsonldInput) : jsonldInput
    const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' })
    return fromNQuadsToQuads(nquads)
}

/**
 * Convert RDFa 1.1 HTML to Quads
 * @param {string} html - HTML text with RDFa markup
 * @param {object} [options] - RDFa parsing options (baseIRI, vocab, language, profile)
 * @returns {Array} RDFJS Quad array
 */
export const fromRDFaToQuads = (html, options = {}) => {
    return parseRDFa(html, {
        dataFactory: DataFactory,
        ...options
    })
}

/**
 * Convert Quads to Turtle
 * @param {Array} quads - RDFJS Quad array
 * @param {object} [options] - Writer options (e.g., prefixes)
 * @returns {Promise<string>} Turtle text
 */
export const toTurtleFromQuads = async (quads, options = {}) => {
    const writer = new Writer({ format: 'text/turtle', ...options })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

/**
 * Convert Quads to TriG
 * @param {Array} quads - RDFJS Quad array
 * @param {object} [options] - Writer options (e.g., prefixes)
 * @returns {Promise<string>} TriG text
 */
export const toTriGFromQuads = async (quads, options = {}) => {
    const writer = new Writer({ format: 'application/trig', ...options })
    quads.forEach(q => writer.addQuad(q))
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

/**
 * Convert Quads to N-Triples
 * @param {Array} quads - RDFJS Quad array
 * @returns {Promise<string>} N-Triples text
 */
export const toNTriplesFromQuads = async (quads) => {
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
 * Convert Quads to N-Quads
 * @param {Array} quads - RDFJS Quad array
 * @returns {Promise<string>} N-Quads text
 */
export const toNQuadsFromQuads = async (quads) => {
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
 * Convert Quads to JSON-LD
 * @param {Array} quads - RDFJS Quad array
 * @param {object} [options] - JSON-LD serialization options
 * @returns {Promise<object>} JSON-LD object
 */
export const toJSONLDFromQuads = async (quads, options = {}) => {
    const nquads = await toNQuadsFromQuads(quads)
    return jsonld.fromRDF(nquads, options)
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