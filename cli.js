#!/usr/bin/env node
// mdld-convert CLI
// Usage: mdld-convert <format> [options]
// Formats: turtle, trig, nt, nq, jsonld, rdfa

import { readFileSync, writeFileSync } from 'fs'
import {
  fromTurtle, fromTriG, fromNTriples, fromNQuads, fromRDF, fromJSONLD, fromRDFa,
  fromTurtleWithContext, fromTriGWithContext, fromJSONLDWithContext, fromRDFaWithContext,
  fromTurtleToQuads, fromTriGToQuads, fromNTriplesToQuads, fromNQuadsToQuads, fromJSONLDToQuads, fromRDFaToQuads,
  toTurtle, toTriG, toNTriples, toNQuads, toRDF, toJSONLD,
  toTurtleWithContext, toTriGWithContext,
  toTurtleFromQuads, toTriGFromQuads, toNTriplesFromQuads, toNQuadsFromQuads, toJSONLDFromQuads,
  quadsToJSON, jsonToQuads
} from './dist/index.js'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('mdld-convert - Convert between RDF formats and MD-LD')
  console.log('')
  console.log('Usage: mdld-convert <format> [options]')
  console.log('')
  console.log('Import (RDF → MD-LD):')
  console.log('  mdld-convert turtle    Convert Turtle to MD-LD')
  console.log('  mdld-convert trig      Convert TriG to MD-LD')
  console.log('  mdld-convert nt        Convert N-Triples to MD-LD')
  console.log('  mdld-convert nq        Convert N-Quads to MD-LD')
  console.log('  mdld-convert jsonld    Convert JSON-LD to MD-LD')
  console.log('  mdld-convert rdfa      Convert RDFa HTML to MD-LD')
  console.log('')
  console.log('Export (MD-LD → RDF):')
  console.log('  mdld-convert --to turtle    Convert MD-LD to Turtle')
  console.log('  mdld-convert --to trig      Convert MD-LD to TriG')
  console.log('  mdld-convert --to nt        Convert MD-LD to N-Triples')
  console.log('  mdld-convert --to nq        Convert MD-LD to N-Quads')
  console.log('  mdld-convert --to jsonld    Convert MD-LD to JSON-LD')
  console.log('')
  console.log('Quad-Target (RDF ↔ Quads, skip MD-LD):')
  console.log('  mdld-convert quads      Convert RDF to Quads (JSON)')
  console.log('  mdld-convert --to quads  Convert Quads (JSON) to RDF')
  console.log('')
  console.log('Options:')
  console.log('  -i, --input <file>    Read from file (default: stdin)')
  console.log('  -o, --output <file>   Write to file (default: stdout)')
  console.log('  --base <iri>          Base IRI for RDFa/JSON-LD')
  console.log('  --vocab <iri>         Vocabulary IRI for RDFa')
  console.log('')
  console.log('Examples:')
  console.log('  cat data.ttl | mdld-convert turtle')
  console.log('  mdld-convert turtle -i data.ttl -o data.mdld')
  console.log('  mdld-convert --to turtle -i data.mdld -o data.ttl')
  console.log('  cat data.ttl | mdld-convert quads | jq .')
  process.exit(1)
}

const format = args[0].toLowerCase()
const isExport = format === '--to'

if (isExport) {
  const targetFormat = args[1]?.toLowerCase()
  if (!targetFormat) {
    console.error('Error: --to requires a target format')
    process.exit(1)
  }
  exportFormat(targetFormat, args.slice(2))
} else {
  importFormat(format, args.slice(1))
}

function parseOptions(argArray) {
  const options = {}
  const files = {}

  for (let i = 0; i < argArray.length; i++) {
    const arg = argArray[i]
    const next = argArray[i + 1]

    if (arg === '-i' || arg === '--input') {
      files.input = next
      i++
    } else if (arg === '-o' || arg === '--output') {
      files.output = next
      i++
    } else if (arg === '--base') {
      options.baseIRI = next
      i++
    } else if (arg === '--vocab') {
      options.vocab = next
      i++
    }
  }

  return { options, files }
}

function getInput(files) {
  if (files.input) {
    return readFileSync(files.input, 'utf8')
  }
  // Read from stdin
  let data = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => data += chunk)
  return new Promise(resolve => {
    process.stdin.on('end', () => resolve(data))
  })
}

function setOutput(files, data) {
  if (files.output) {
    writeFileSync(files.output, data)
  } else {
    console.log(data)
  }
}

async function importFormat(format, argArray) {
  const { options, files } = parseOptions(argArray)
  const input = await getInput(files)
  let result

  try {
    switch (format) {
      case 'turtle':
        result = await fromTurtleWithContext(input)
        result = result.text  // Return only text for CLI
        break
      case 'trig':
        result = await fromTriGWithContext(input)
        result = result.text
        break
      case 'nt':
        result = fromNTriples(input)
        break
      case 'nq':
        result = fromNQuads(input)
        break
      case 'jsonld':
        result = await fromJSONLDWithContext(input)
        result = result.text
        break
      case 'rdfa':
        result = fromRDFaWithContext(input, options)
        result = result.text
        break
      case 'quads':
        // Auto-detect source format and convert to quads
        if (input.includes('@prefix') || input.includes('@base') || input.includes('a ')) {
          result = quadsToJSON(fromTurtleToQuads(input))
        } else if (input.includes('{') && input.includes('}')) {
          result = quadsToJSON(fromTriGToQuads(input))
        } else if (input.startsWith('<')) {
          result = quadsToJSON(fromNQuadsToQuads(input))
        } else if (input.startsWith('{') || input.startsWith('[')) {
          const quads = await fromJSONLDToQuads(input)
          result = quadsToJSON(quads)
        } else {
          result = quadsToJSON(fromNTriplesToQuads(input))
        }
        break
      default:
        console.error(`Error: Unknown format '${format}'`)
        console.error('Supported formats: turtle, trig, nt, nq, jsonld, rdfa, quads')
        process.exit(1)
    }

    setOutput(files, result)
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

async function exportFormat(format, argArray) {
  const { options, files } = parseOptions(argArray)
  const input = await getInput(files)
  let result

  try {
    switch (format) {
      case 'turtle':
        result = await toTurtleWithContext(input, options)
        result = result.text
        break
      case 'trig':
        result = await toTriGWithContext(input, options)
        result = result.text
        break
      case 'nt':
        result = await toNTriples(input)
        break
      case 'nq':
        result = await toNQuads(input)
        break
      case 'jsonld':
        result = await toJSONLD(input, options)
        break
      case 'quads':
        // Parse JSON quads and convert to target format
        const quads = jsonToQuads(input)
        // Default to Turtle for quads export
        result = await toTurtleFromQuads(quads, options)
        break
      default:
        console.error(`Error: Unknown format '${format}'`)
        console.error('Supported formats: turtle, trig, nt, nq, jsonld, quads')
        process.exit(1)
    }

    // JSON-LD returns object, stringify it
    if (format === 'jsonld') {
      result = JSON.stringify(result, null, 2)
    }

    setOutput(files, result)
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}
