# mdld-convert

Gateway between MD-LD and standard RDF formats. Convert between Turtle, TriG, N-Triples, N-Quads, JSON-LD, RDFa, and MD-LD.

[NPM](https://www.npmjs.com/package/mdld-convert)

## Features

- **Simplified API**: Single `convert()` function for all format conversions
- **Comprehensive format support**: Turtle, TriG, N-Triples, N-Quads, JSON-LD, RDFa 1.1
- **Context preservation**: Prefixes and vocabularies preserved by default
- **Quad-target API**: Direct RDF ↔ Quads conversion for performance and quad-* ecosystem integration
- **Zero-dependency kernel**: Uses external libraries (N3.js, jsonld.js, rdfa-parse) bundled into single ESM file
- **CLI tool**: Command-line interface for terminal usage with quad JSON serialization
- **Round-trip safe**: Deterministic conversions preserve semantic information

## Installation

```bash
npm install mdld-convert
```

## Library API

### Core Conversion Function

```javascript
import { convert, quadsToJSON, jsonToQuads } from 'mdld-convert'
```

**Universal conversion between any supported formats:**

```javascript
const result = await convert({
  input,           // string (text) or object (JSON-LD)
  from,            // 'turtle', 'trig', 'nt', 'nq', 'jsonld', 'rdfa', 'mdld', 'quads'
  to,              // 'turtle', 'trig', 'nt', 'nq', 'jsonld', 'mdld', 'quads'
  context,         // prefix mappings for output (optional)
  baseIRI,         // base IRI for RDFa/JSON-LD (optional)
  vocab,           // vocabulary IRI for RDFa (optional)
  returnQuads      // return { quads, text } instead of just text (optional)
})
```

### Examples

**RDF → MD-LD:**
```javascript
const mdld = await convert({ 
  input: turtleText, 
  from: 'turtle', 
  to: 'mdld' 
})
```

**MD-LD → RDF:**
```javascript
const turtle = await convert({ 
  input: mdldText, 
  from: 'mdld', 
  to: 'turtle' 
})
```

**RDF → RDF (skip MD-LD):**
```javascript
const trig = await convert({ 
  input: turtleText, 
  from: 'turtle', 
  to: 'trig' 
})
```

**With context preservation:**
```javascript
const turtle = await convert({ 
  input: mdldText, 
  from: 'mdld', 
  to: 'turtle',
  context: { ex: 'http://example.org/' }
})
```

**Return quads for processing:**
```javascript
const { quads, text } = await convert({ 
  input: turtleText, 
  from: 'turtle', 
  to: 'turtle',
  returnQuads: true 
})
// Filter quads, then convert back
const filtered = quads.filter(q => q.predicate.value !== 'http://example.org/internal')
const result = await convert({ 
  input: filtered, 
  from: 'quads', 
  to: 'turtle' 
})
```

**RDFa with options:**
```javascript
const mdld = await convert({ 
  input: htmlText, 
  from: 'rdfa', 
  to: 'mdld',
  baseIRI: 'http://example.org/',
  vocab: 'http://schema.org/'
})
```

### Quad Utilities

```javascript
// Serialize quads to JSON
const json = quadsToJSON(quads)

// Deserialize JSON to quads
const quads = jsonToQuads(json)
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

# Quad-Target (RDF ↔ Quads, skip MD-LD)
cat data.ttl | mdld-convert quads | jq .
mdld-convert quads -i data.ttl -o quads.json
cat quads.json | mdld-convert --to quads -o data.ttl
```

### CLI Options

- `-i, --input <file>` - Read from file (default: stdin)
- `-o, --output <file>` - Write to file (default: stdout)
- `--base <iri>` - Base IRI for RDFa/JSON-LD
- `--vocab <iri>` - Vocabulary IRI for RDFa

## Supported Formats

| Format | Import | Export | Context | Quad-Target |
|--------|--------|--------|---------|-------------|
| Turtle | ✓ | ✓ | ✓ | ✓ |
| TriG | ✓ | ✓ | ✓ | ✓ |
| N-Triples | ✓ | ✓ | - | ✓ |
| N-Quads | ✓ | ✓ | - | ✓ |
| JSON-LD | ✓ | ✓ | ✓ | ✓ |
| RDFa 1.1 | ✓ | - | ✓ | ✓ |
| MD-LD | ✓ | ✓ | ✓ | ✓ |
| Quads (JSON) | ✓ | ✓ | - | ✓ |

## Complete Example

```javascript
import { convert, quadsToJSON, jsonToQuads } from 'mdld-convert'

// Turtle → MD-LD
const turtle = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    ex:firstName "Alice" ;
    ex:lastName "Smith" .`

const mdld = await convert({ input: turtle, from: 'turtle', to: 'mdld' })
console.log(mdld)
// Output:
// [ex] <http://example.org/>
// [foaf] <http://xmlns.com/foaf/0.1/>
//
// # alice {=ex:alice .foaf:Person}
// [Alice] {ex:firstName}
// [Smith] {ex:lastName}

// MD-LD → Turtle (context preserved)
const turtle = await convert({ input: mdld, from: 'mdld', to: 'turtle' })
console.log(turtle.includes('@prefix ex:')) // true

// Turtle → Quads → Turtle (processing pipeline)
const { quads } = await convert({ 
  input: turtle, 
  from: 'turtle', 
  to: 'turtle',
  returnQuads: true 
})
const filtered = quads.filter(q => !q.predicate.value.includes('internal'))
const result = await convert({ 
  input: quadsToJSON(filtered), 
  from: 'quads', 
  to: 'turtle' 
})
```

## Architecture

- **N3.js**: Turtle/TriG/N-Triples/N-Quads parsing and serialization
- **jsonld.js**: JSON-LD processing
- **rdfa-parse**: RDFa 1.1 Core parsing
- **mdld-parse**: MD-LD parsing and generation

- **Vite**: Bundles all dependencies into single ESM file
