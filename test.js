// mdld-convert test suite
// Testing the simplified convert() API

import { parse, generate } from 'mdld-parse'

import {
  convert,
  quadsToJSON,
  jsonToQuads
} from './index.js'

// Single source of truth: MD-LD sample
const SOURCE_MDLD = `[ex] <http://example.org/>
[foaf] <http://xmlns.com/foaf/0.1/>

# Alice {=ex:alice .foaf:Person}
[Alice] {ex:firstName}
[Smith] {ex:lastName}
[Alice Smith] {ex:fullName}`

// Expected outputs for comparison
const EXPECTED_TURTLE = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    ex:firstName "Alice" ;
    ex:fullName "Alice Smith" ;
    ex:lastName "Smith" .`

const EXPECTED_NTRIPLES = `<http://example.org/alice> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> .
<http://example.org/alice> <http://example.org/firstName> "Alice" .
<http://example.org/alice> <http://example.org/lastName> "Smith" .
<http://example.org/alice> <http://example.org/fullName> "Alice Smith" .`

const EXPECTED_JSONLD = {
  "@context": {
    "ex": "http://example.org/",
    "foaf": "http://xmlns.com/foaf/0.1/"
  },
  "@id": "ex:alice",
  "@type": "foaf:Person",
  "ex:firstName": "Alice",
  "ex:lastName": "Smith",
  "ex:fullName": "Alice Smith"
}

// Test helper
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const normalizeTurtle = (turtle) => {
  return turtle.replace(/\s+/g, ' ').trim()
}

async function runTests() {
  let passed = 0
  let failed = 0

  const test = async (name, fn) => {
    try {
      await fn()
      passed++
      console.log(`✓ ${name}`)
    } catch (error) {
      failed++
      console.log(`✗ ${name}: ${error.message}`)
    }
  }

  console.log('Running mdld-convert tests...')

  // === Basic Conversions ===

  await test('convert: turtle → mdld', async () => {
    const mdld = await convert({ input: EXPECTED_TURTLE, from: 'turtle', to: 'mdld' })
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('convert: mdld → turtle', async () => {
    const turtle = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'turtle' })
    assert(turtle.includes('ex:alice'), 'Subject not in output')
  })

  await test('convert: mdld → trig', async () => {
    const trig = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'trig' })
    assert(trig.includes('ex:alice'), 'Subject not in output')
  })

  await test('convert: mdld → nt', async () => {
    const nt = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'nt' })
    assert(nt.includes('<http://example.org/alice>'), 'Subject not in output')
  })

  await test('convert: mdld → nq', async () => {
    const nq = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'nq' })
    assert(nq.includes('<http://example.org/alice>'), 'Subject not in output')
  })

  await test('convert: mdld → jsonld', async () => {
    const jsonld = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'jsonld' })
    assert(jsonld['@id'] || jsonld[0]?.['@id'], '@id not in JSON-LD')
  })

  await test('convert: jsonld → mdld', async () => {
    const mdld = await convert({ input: EXPECTED_JSONLD, from: 'jsonld', to: 'mdld' })
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('convert: nt → mdld', async () => {
    const mdld = await convert({ input: EXPECTED_NTRIPLES, from: 'nt', to: 'mdld' })
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('convert: nq → mdld', async () => {
    const nq = `<http://example.org/alice> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> <http://example.org/graph> .
<http://example.org/alice> <http://example.org/firstName> "Alice" <http://example.org/graph> .
<http://example.org/alice> <http://example.org/lastName> "Smith" <http://example.org/graph> .
<http://example.org/alice> <http://example.org/fullName> "Alice Smith" <http://example.org/graph> .`
    const mdld = await convert({ input: nq, from: 'nq', to: 'mdld' })
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('convert: rdfa → mdld', async () => {
    const html = `<div vocab="http://schema.org/" typeof="Person" about="#alice">
  <span property="name">Alice Smith</span>
  <span property="givenName">Alice</span>
  <span property="familyName">Smith</span>
</div>`
    const mdld = await convert({ input: html, from: 'rdfa', to: 'mdld', baseIRI: 'http://example.org/' })
    const { quads } = parse(mdld)
    assert(quads.length > 0, 'No quads generated from RDFa')
  })

  // === Context Preservation ===

  await test('convert: turtle → mdld with context', async () => {
    const { quads, text } = await convert({ input: EXPECTED_TURTLE, from: 'turtle', to: 'mdld', returnQuads: true })
    assert(quads.length === 4, 'Quad count mismatch')
    assert(text.includes('[ex]'), 'Prefix not in MD-LD')
  })

  await test('convert: mdld → turtle with context', async () => {
    const turtle = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'turtle' })
    assert(turtle.includes('@prefix ex:'), 'ex prefix not preserved')
    assert(turtle.includes('@prefix foaf:'), 'foaf prefix not preserved')
  })

  await test('convert: jsonld → mdld with context', async () => {
    const mdld = await convert({ input: EXPECTED_JSONLD, from: 'jsonld', to: 'mdld' })
    assert(mdld.includes('[ex]'), 'ex prefix not in MD-LD')
  })

  // === RDF-to-RDF Conversions (skip MD-LD) ===

  await test('convert: turtle → turtle (direct)', async () => {
    const turtle = await convert({ input: EXPECTED_TURTLE, from: 'turtle', to: 'turtle' })
    assert(turtle.includes('ex:alice'), 'Subject not in output')
  })

  await test('convert: turtle → trig (direct)', async () => {
    const trig = await convert({ input: EXPECTED_TURTLE, from: 'turtle', to: 'trig' })
    assert(trig.includes('ex:alice'), 'Subject not in output')
  })

  await test('convert: turtle → nt (direct)', async () => {
    const nt = await convert({ input: EXPECTED_TURTLE, from: 'turtle', to: 'nt' })
    assert(nt.includes('<http://example.org/alice>'), 'Subject not in output')
  })

  await test('convert: jsonld → turtle (direct)', async () => {
    const turtle = await convert({ input: EXPECTED_JSONLD, from: 'jsonld', to: 'turtle' })
    assert(turtle.includes('ex:alice'), 'Subject not in output')
  })

  // === Quad JSON Serialization ===

  await test('convert: turtle → quads (JSON)', async () => {
    const json = await convert({ input: EXPECTED_TURTLE, from: 'turtle', to: 'quads' })
    const quads = JSON.parse(json)
    assert(Array.isArray(quads), 'Not an array')
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('convert: quads (JSON) → turtle', async () => {
    const json = await convert({ input: EXPECTED_TURTLE, from: 'turtle', to: 'quads' })
    const turtle = await convert({ input: json, from: 'quads', to: 'turtle', context: { ex: 'http://example.org/', foaf: 'http://xmlns.com/foaf/0.1/' } })
    assert(turtle.includes('ex:alice'), 'Subject not in output')
  })

  await test('quadsToJSON: serialize quads', () => {
    const { quads } = parse(SOURCE_MDLD)
    const json = quadsToJSON(quads)
    const parsed = JSON.parse(json)
    assert(Array.isArray(parsed), 'Not an array')
    assert(parsed.length === 4, 'Quad count mismatch')
  })

  await test('jsonToQuads: deserialize quads', () => {
    const { quads: original } = parse(SOURCE_MDLD)
    const json = quadsToJSON(original)
    const quads = jsonToQuads(json)
    assert(quads.length === original.length, 'Quad count mismatch')
  })

  // === Custom Context ===

  await test('convert: with custom context', async () => {
    const turtle = await convert({
      input: SOURCE_MDLD,
      from: 'mdld',
      to: 'turtle',
      context: { custom: 'http://custom.org/' }
    })
    assert(turtle.includes('@prefix custom:'), 'Custom prefix not added')
  })

  // === Round-Trip Tests ===

  await test('convert: mdld → turtle preserves quads', async () => {
    const { quads: originalQuads } = parse(SOURCE_MDLD)
    const { quads } = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'turtle', returnQuads: true })
    assert(quads.length === originalQuads.length, 'Quad count mismatch')
  })

  await test('round-trip: mdld → jsonld → mdld', async () => {
    const jsonld = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'jsonld' })
    const mdld = await convert({ input: jsonld, from: 'jsonld', to: 'mdld' })
    const { quads: originalQuads } = parse(SOURCE_MDLD)
    const { quads: roundTripQuads } = parse(mdld)
    assert(roundTripQuads.length === originalQuads.length, 'Round-trip quad count mismatch')
  })

  await test('round-trip: mdld → nt → mdld', async () => {
    const nt = await convert({ input: SOURCE_MDLD, from: 'mdld', to: 'nt' })
    const mdld = await convert({ input: nt, from: 'nt', to: 'mdld' })
    const { quads: originalQuads } = parse(SOURCE_MDLD)
    const { quads: roundTripQuads } = parse(mdld)
    assert(roundTripQuads.length === originalQuads.length, 'Round-trip quad count mismatch')
  })

  // === Error Handling ===

  await test('convert: unknown from format', async () => {
    try {
      await convert({ input: 'test', from: 'unknown', to: 'mdld' })
      assert(false, 'Should have thrown error')
    } catch (error) {
      assert(error.message.includes('Unknown source format'), 'Wrong error message')
    }
  })

  // === Summary ===

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests()
