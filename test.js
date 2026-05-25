// mdld-convert test suite
// DRY approach: single source MD-LD, test all conversions round-trip

import { parse, generate } from 'mdld-parse'
import { Parser } from 'n3'
import {
  fromTurtle, fromTriG, fromNTriples, fromNQuads, fromRDF, fromJSONLD, fromRDFa,
  fromTurtleWithContext, fromTriGWithContext, fromJSONLDWithContext, fromRDFaWithContext,
  toTurtle, toTriG, toNTriples, toNQuads, toRDF, toJSONLD,
  toTurtleWithContext, toTriGWithContext
} from './index.js'

// Single source of truth: MD-LD sample
const SOURCE_MDLD = `[ex] <http://example.org/>
[foaf] <http://xmlns.com/foaf/0.1/>

# Alice {=ex:alice .foaf:Person}
[Alice] {ex:firstName}
[Smith] {ex:lastName}
[Alice Smith] {ex:fullName}`

// Expected Turtle (for comparison)
const EXPECTED_TURTLE = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    ex:firstName "Alice" ;
    ex:lastName "Smith" ;
    ex:fullName "Alice Smith" .`

// Expected N-Triples (canonical form)
const EXPECTED_NTRIPLES = `<http://example.org/alice> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> .
<http://example.org/alice> <http://example.org/firstName> "Alice" .
<http://example.org/alice> <http://example.org/lastName> "Smith" .
<http://example.org/alice> <http://example.org/fullName> "Alice Smith" .`

// Expected JSON-LD structure
const EXPECTED_JSONLD = {
  '@context': {
    ex: 'http://example.org/',
    foaf: 'http://xmlns.com/foaf/0.1/'
  },
  '@id': 'ex:alice',
  '@type': 'foaf:Person',
  'ex:firstName': 'Alice',
  'ex:lastName': 'Smith',
  'ex:fullName': 'Alice Smith'
}

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

const normalizeNTriples = (nt) => {
  return nt.trim().split('.').map(s => s.trim()).filter(Boolean).sort().join('.\n') + '.'
}

const normalizeTurtle = (turtle) => {
  // Normalize Turtle for comparison (remove extra whitespace, sort triples)
  return turtle.trim()
}

// Test runner
const runTests = async () => {
  let passed = 0
  let failed = 0

  const test = async (name, fn) => {
    try {
      await fn()
      console.log(`✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`✗ ${name}: ${e.message}`)
      failed++
    }
  }

  console.log('Running mdld-convert tests...\n')

  // === Import Tests (RDF → MD-LD) ===

  await test('fromTurtle: basic conversion', () => {
    const mdld = fromTurtle(EXPECTED_TURTLE)
    const { quads: originalQuads } = parse(SOURCE_MDLD)
    const { quads: convertedQuads } = parse(mdld)
    assert(convertedQuads.length === originalQuads.length, 'Quad count mismatch')
  })

  await test('fromTriG: basic conversion', () => {
    const trig = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

{
  ex:alice a foaf:Person ;
    ex:firstName "Alice" ;
    ex:lastName "Smith" ;
    ex:fullName "Alice Smith" .
}`
    const mdld = fromTriG(trig)
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromNTriples: basic conversion', () => {
    const mdld = fromNTriples(EXPECTED_NTRIPLES)
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromNQuads: basic conversion', () => {
    const nq = `<http://example.org/alice> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> <http://example.org/graph> .
<http://example.org/alice> <http://example.org/firstName> "Alice" <http://example.org/graph> .
<http://example.org/alice> <http://example.org/lastName> "Smith" <http://example.org/graph> .
<http://example.org/alice> <http://example.org/fullName> "Alice Smith" <http://example.org/graph> .`
    const mdld = fromNQuads(nq)
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromRDF: auto-detect Turtle', () => {
    const mdld = fromRDF(EXPECTED_TURTLE)
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromRDF: auto-detect N-Triples', () => {
    const mdld = fromRDF(EXPECTED_NTRIPLES)
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromRDF: explicit format', () => {
    const mdld = fromRDF(EXPECTED_TURTLE, 'turtle')
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromJSONLD: basic conversion', async () => {
    const mdld = await fromJSONLD(EXPECTED_JSONLD)
    const { quads } = parse(mdld)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromRDFa: basic conversion', () => {
    const html = `<div vocab="http://schema.org/" typeof="Person" about="#alice">
  <span property="name">Alice Smith</span>
  <span property="givenName">Alice</span>
  <span property="familyName">Smith</span>
</div>`
    const mdld = fromRDFa(html, { baseIRI: 'http://example.org/' })
    const { quads } = parse(mdld)
    assert(quads.length > 0, 'No quads generated from RDFa')
  })

  await test('fromRDFaWithContext: preserves vocab', () => {
    const html = `<div vocab="http://schema.org/" typeof="Person" about="#alice">
  <span property="name">Alice Smith</span>
</div>`
    const { text, context } = fromRDFaWithContext(html, {
      baseIRI: 'http://example.org/',
      vocab: 'http://schema.org/'
    })
    assert(context[''] === 'http://schema.org/', 'Vocab not preserved as default prefix')
  })

  // === Context Preservation Tests ===

  await test('fromTurtleWithContext: preserves prefixes', async () => {
    const { text, context } = await fromTurtleWithContext(EXPECTED_TURTLE)
    assert(context.ex === 'http://example.org/', 'ex prefix not preserved')
    assert(context.foaf === 'http://xmlns.com/foaf/0.1/', 'foaf prefix not preserved')
    const { quads } = parse(text)
    assert(quads.length === 4, 'Quad count mismatch')
  })

  await test('fromTriGWithContext: preserves prefixes', async () => {
    const trig = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

{
  ex:alice a foaf:Person ;
    ex:firstName "Alice" .
}`
    const { text, context } = await fromTriGWithContext(trig)
    assert(context.ex === 'http://example.org/', 'ex prefix not preserved')
    assert(context.foaf === 'http://xmlns.com/foaf/0.1/', 'foaf prefix not preserved')
  })

  await test('fromJSONLDWithContext: preserves context', async () => {
    const { text, context } = await fromJSONLDWithContext(EXPECTED_JSONLD)
    assert(context.ex === 'http://example.org/', 'ex prefix not preserved')
    assert(context.foaf === 'http://xmlns.com/foaf/0.1/', 'foaf prefix not preserved')
  })

  // === Export Tests (MD-LD → RDF) ===

  await test('toTurtle: basic conversion', async () => {
    const turtle = await toTurtle(SOURCE_MDLD)
    const normalized = normalizeTurtle(turtle)
    assert(normalized.includes('ex:alice'), 'Subject not in output')
    assert(normalized.includes('foaf:Person'), 'Type not in output')
  })

  await test('toTriG: basic conversion', async () => {
    const trig = await toTriG(SOURCE_MDLD)
    assert(trig.includes('ex:alice'), 'Subject not in output')
  })

  await test('toNTriples: basic conversion', async () => {
    const nt = await toNTriples(SOURCE_MDLD)
    const normalized = normalizeNTriples(nt)
    const expectedNormalized = normalizeNTriples(EXPECTED_NTRIPLES)
    assert(normalized === expectedNormalized, 'N-Triples mismatch')
  })

  await test('toNQuads: basic conversion', async () => {
    const nq = await toNQuads(SOURCE_MDLD)
    assert(nq.includes('<http://example.org/alice>'), 'Subject not in output')
  })

  await test('toRDF: format selection', async () => {
    const turtle = await toRDF(SOURCE_MDLD, 'turtle')
    assert(turtle.includes('@prefix'), 'Prefix not in Turtle output')
  })

  await test('toJSONLD: basic conversion', async () => {
    const jsonld = await toJSONLD(SOURCE_MDLD)
    assert(jsonld['@id'] || jsonld[0]?.['@id'], '@id not in JSON-LD')
  })

  // === Context Preservation Export Tests ===

  await test('toTurtleWithContext: preserves context', async () => {
    const { text, context } = await toTurtleWithContext(SOURCE_MDLD)
    assert(context.ex === 'http://example.org/', 'ex prefix not preserved')
    assert(text.includes('@prefix ex:'), 'Prefix not in Turtle output')
  })

  await test('toTriGWithContext: preserves context', async () => {
    const { text, context } = await toTriGWithContext(SOURCE_MDLD)
    assert(context.ex === 'http://example.org/', 'ex prefix not preserved')
  })

  // === Round-Trip Tests ===

  await test('Round-trip: MD-LD → N-Triples → MD-LD', async () => {
    const nt = await toNTriples(SOURCE_MDLD)
    const mdld = fromNTriples(nt)
    const { quads: originalQuads } = parse(SOURCE_MDLD)
    const { quads: roundTripQuads } = parse(mdld)
    assert(roundTripQuads.length === originalQuads.length, 'Round-trip quad count mismatch')
  })

  await test('Round-trip: MD-LD → JSON-LD → MD-LD', async () => {
    const jsonld = await toJSONLD(SOURCE_MDLD)
    const mdld = await fromJSONLD(jsonld)
    const { quads: originalQuads } = parse(SOURCE_MDLD)
    const { quads: roundTripQuads } = parse(mdld)
    assert(roundTripQuads.length === originalQuads.length, 'Round-trip quad count mismatch')
  })

  // === Summary ===

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests()
