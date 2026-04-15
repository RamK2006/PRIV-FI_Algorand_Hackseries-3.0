/**
 * Circuit Export Script
 * Copies compiled Noir circuit JSON to frontend and delegation server.
 * Run after: cd packages/circuits/credit_oracle && nargo compile
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'credit_oracle', 'target', 'credit_oracle.json');
const DESTINATIONS = [
  path.join(__dirname, '..', '..', 'frontend', 'src', 'circuits', 'credit_oracle.json'),
  path.join(__dirname, '..', '..', 'delegation-server', 'circuit', 'credit_oracle.json'),
];

function exportCircuit() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`ERROR: Compiled circuit not found at ${SOURCE}`);
    console.error('Run: cd packages/circuits/credit_oracle && nargo compile');
    process.exit(1);
  }

  const circuitData = fs.readFileSync(SOURCE, 'utf-8');
  console.log(`Found compiled circuit: ${SOURCE}`);

  for (const dest of DESTINATIONS) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      console.log(`  Created directory: ${destDir}`);
    }
    fs.writeFileSync(dest, circuitData);
    console.log(`  Exported to: ${dest}`);
  }

  console.log('\nCircuit export complete!');
}

exportCircuit();
