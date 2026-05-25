# mdld-convert

Gateway between MD-LD and standard RDF formats. Convert between Turtle, TriG, N-Triples, N-Quads, JSON-LD, RDFa, and MD-LD.

## Features

- **Comprehensive format support**: Turtle, TriG, N-Triples, N-Quads, JSON-LD, RDFa 1.1
- **Context preservation**: Prefixes and vocabularies preserved across conversions
- **Zero-dependency kernel**: Uses external libraries (N3.js, jsonld.js, rdfa-parse) bundled into single ESM file
- **CLI tool**: Command-line interface for terminal usage
- **Round-trip safe**: Deterministic conversions preserve semantic information

## Installation

```bash
npm install mdld-convert
```

## CLI Usage

```bash
# Import (RDF → MD-LD)
cat data.ttl | mdld-convert turtle
mdld-convert turtle -i data.ttl -o data.mdld
mdld-convert jsonld -i data.jsonld -o data.mdld
mdld-convert rdfa -i data.html --base http://example.org/ -o data.mdld

# Export (MD-LD → RDF)
cat data.mdld | mdld-convert --to turtle
mdld-convert --to turtle -i data.mdld -o data.ttl
mdld-convert --to jsonld -i data.mdld -o data.jsonld
```

### CLI Options

- `-i, --input <file>` - Read from file (default: stdin)
- `-o, --output <file>` - Write to file (default: stdout)
- `--base <iri>` - Base IRI for RDFa/JSON-LD
- `--vocab <iri>` - Vocabulary IRI for RDFa

## Library API

### Import (RDF → MD-LD)

```javascript
import { fromTurtle, fromTriG, fromNTriples, fromNQuads, fromRDF, fromJSONLD, fromRDFa } from 'mdld-convert'

// Synchronous conversions
const mdld = fromTurtle(turtleText)
const mdld = fromTriG(trigText)
const mdld = fromNTriples(ntText)
const mdld = fromNQuads(nqText)

// Auto-detect format
const mdld = fromRDF(text) // Auto-detects Turtle, TriG, N-Triples, N-Quads
const mdld = fromRDF(text, 'turtle') // Explicit format

// Asynchronous conversions
const mdld = await fromJSONLD(jsonldText)
const mdld = fromRDFa(htmlText, { baseIRI: 'http://example.org/' })
```

### Export (MD-LD → RDF)

```javascript
import { toTurtle, toTriG, toNTriples, toNQuads, toRDF, toJSONLD } from 'mdld-convert'

// All exports are async
const turtle = await toTurtle(mdldText)
const trig = await toTriG(mdldText)
const nt = await toNTriples(mdldText)
const nq = await toNQuads(mdldText)
const jsonld = await toJSONLD(mdldText)

// Format selection
const turtle = await toRDF(mdldText, 'turtle')
const nq = await toRDF(mdldText, 'nq')
```

### Context Preservation

Context-preserving functions return `{ text, context }` and maintain prefix mappings:

```javascript
import { 
  fromTurtleWithContext, fromTriGWithContext, fromJSONLDWithContext, fromRDFaWithContext,
  toTurtleWithContext, toTriGWithContext
} from 'mdld-convert'

// Import with context
const { text, context } = await fromTurtleWithContext(turtleText)
console.log(context) // { ex: 'http://example.org/', foaf: 'http://xmlns.com/foaf/0.1/' }

// Export with context
const { text, context } = await toTurtleWithContext(mdldText)
console.log(context) // Preserved prefix mappings
```

**Note:** The CLI always uses context-preserving functions by default.

## Supported Formats

| Format | Import | Export | Context |
|--------|--------|--------|---------|
| Turtle | ✓ | ✓ | ✓ |
| TriG | ✓ | ✓ | ✓ |
| N-Triples | ✓ | ✓ | - |
| N-Quads | ✓ | ✓ | - |
| JSON-LD | ✓ | ✓ | ✓ |
| RDFa 1.1 | ✓ | - | ✓ |

## Examples

### Turtle → MD-LD

```javascript
import { fromTurtle } from 'mdld-convert'

const turtle = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    ex:firstName "Alice" ;
    ex:lastName "Smith" .`

const mdld = fromTurtle(turtle)
console.log(mdld)
```

Output:
```markdown
[ex] <http://example.org/>
[foaf] <http://xmlns.com/foaf/0.1/>

# alice {=ex:alice .foaf:Person}
[Alice] {ex:firstName}
[Smith] {ex:lastName}
```

### MD-LD → Turtle

```javascript
import { toTurtle } from 'mdld-convert'

const mdld = `[ex] <http://example.org/>

# Alice {=ex:alice .foaf:Person}
[Alice] {ex:firstName}
[Smith] {ex:lastName}`

const turtle = await toTurtle(mdld)
console.log(turtle)
```

### JSON-LD → MD-LD

```javascript
import { fromJSONLD } from 'mdld-convert'

const jsonld = {
  "@context": {
    "ex": "http://example.org/",
    "foaf": "http://xmlns.com/foaf/0.1/"
  },
  "@id": "ex:alice",
  "@type": "foaf:Person",
  "ex:firstName": "Alice",
  "ex:lastName": "Smith"
}

const mdld = await fromJSONLD(jsonld)
```

### RDFa → MD-LD

```javascript
import { fromRDFa } from 'mdld-convert'

const html = `<div vocab="http://schema.org/" typeof="Person" about="#alice">
  <span property="name">Alice Smith</span>
</div>`

const mdld = fromRDFa(html, { baseIRI: 'http://example.org/' })
```

## Round-Trip Safety

Context preservation ensures prefixes survive round-trip conversions:

```javascript
import { fromTurtleWithContext, toTurtleWithContext } from 'mdld-convert'

const turtle = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Alice" .`

// Turtle → MD-LD → Turtle
const { text: mdld } = await fromTurtleWithContext(turtle)
const { text: roundtrip } = await toTurtleWithContext(mdld)

// Original prefixes preserved
console.log(roundtrip.includes('@prefix ex:')) // true
```

## Architecture

- **N3.js**: Turtle/TriG/N-Triples/N-Quads parsing and serialization
- **jsonld.js**: JSON-LD processing
- **rdfa-parse**: RDFa 1.1 Core parsing
- **mdld-parse**: MD-LD parsing and generation
- **Vite**: Bundles all dependencies into single ESM file

## Dependencies

- [n3](https://github.com/rdfjs/N3.js) - BSD 3-clause
- [jsonld](https://github.com/digitalbazaar/jsonld.js) - BSD 3-clause
- [rdfa-parse](https://github.com/digitalbazaar/rdfa-parse) - BSD 3-clause
- [mdld-parse](https://github.com/davay42/mdld-parse) - MIT

## Related

- [mdld-parse](https://github.com/davay42/mdld-parse) - MD-LD parsing and generation
- [quad-stack](https://github.com/davay42/quad-stack) - Quad-based RDF operations
