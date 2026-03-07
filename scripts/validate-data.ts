import fs from 'fs';
import path from 'path';
import { parseGatewayData, NetworkInfo, RawCardItem } from '../shared/parser';

const DATA_DIR = path.resolve(__dirname, '../data');

function loadJSON<T>(filename: string): T {
    const filePath = path.join(DATA_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T;
}

try {
    console.log('--- Validating Data Files ---');

    // 1. Load Networks
    console.log('Loading networks.json...');
    const networks = loadJSON<NetworkInfo[]>('networks.json');
    console.log(`  Loaded ${networks.length} networks.`);

    // 2. Load Gateways
    console.log('Loading gateways.json...');
    const gateways = loadJSON<{ id: string; name: string }[]>('gateways.json');
    console.log(`  Found ${gateways.length} gateways.`);

    // 3. Validate each gateway
    for (const gw of gateways) {
        const filename = `${gw.id}.json`;
        console.log(`Validating ${filename}...`);

        if (!fs.existsSync(path.join(DATA_DIR, filename))) {
            throw new Error(`Data file for gateway "${gw.id}" missing: ${filename}`);
        }

        const rawGroups = loadJSON<{ group: string; items: RawCardItem[] }[]>(filename);

        // Attempt parsing
        const parsed = parseGatewayData(gw.id, rawGroups, networks);

        let totalCards = 0;
        parsed.forEach(g => totalCards += g.items.length);
        console.log(`  Success: Parsed ${parsed.length} groups, ${totalCards} total cards.`);
    }

    console.log('\n--- All data files validated successfully! ---');
} catch (error) {
    console.error('\n--- Validation Failed ---');
    console.error(error);
    process.exit(1);
}
