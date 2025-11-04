import { writeFileSync } from "fs";
import { FileCache } from "./FileCache";

const URL_API = 'https://pokeapi.co/api/v2';
const cache = new FileCache('cache', 24);

const finalPokemonFile = './externaldata/pokemon_data.json';

async function importPokemonToJson(): Promise<void> {
  try {
    const finalData: any[] = [];
    
    const pokemon = await cache.get<{ results: any[] }>('pokemon-list', async () => {
      const response = await fetch(`${URL_API}/pokemon?limit=100000&offset=0`);
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      return await response.json() as { results: any[] };
    });

    console.log(`✅ ${pokemon.results.length} Pokémon trouvés`);
    console.log('📥 Import des données des Pokémon...')

    const types = await cache.get<any[]>('type-list', async () => {
      const types = [];
      const response = await fetch(`${URL_API}/type`);
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      const typeList = await response.json() as { results: any[] };

      for (let entry of typeList.results) {
        const typeDataResponse = await fetch(entry.url);
        if (!typeDataResponse.ok) throw new Error(`API Error: ${typeDataResponse.statusText}`);
        const typeData = await typeDataResponse.json() as any;
        types.push({ name: entry.name, ...typeData });
      }
      return types;
    });

    console.log(`✅ ${types.length} types trouvés`);
    
    for (const entry of pokemon.results) {
      const pokemonData = await cache.get<any>(`pokemon-${entry.name}`, async () => {
        const response = await fetch(entry.url);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return await response.json();
      });

      const speciesData = await cache.get<any>(`species-${entry.name}`, async () => {
        const response = await fetch(pokemonData.species.url);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return await response.json();
      });

      // Construire l'objet final

      delete pokemonData.sprites.versions

      finalData.push({
        id: pokemonData.id,
        name: pokemonData.name,
        frName: speciesData.names.find((n: any) => n.language.name === 'fr').name || null,
        cries: pokemonData.cries || null,
        height: pokemonData.height,
        weight: pokemonData.weight,
        sprites: pokemonData.sprites,
        types: pokemonData.types.map((t: any) => ({
          slot: t.slot,
          name: types.find(type => type.name === t.type.name).names.find((n: any) => n.language.name === 'fr').name || t.type.name,
          sprite: types.find(type => type.name === t.type.name).sprites['generation-viii']['sword-shield']['name_icon'] || null
        })),
        species: {
          color: speciesData.color.name,
          evolves_from: speciesData.evolves_from_species?.name || null,
          is_baby: speciesData.is_baby,
          is_legendary: speciesData.is_legendary,
          is_mythical: speciesData.is_mythical
        }
      })
    }

    writeFileSync(finalPokemonFile, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log('🚀 Import terminé avec succès');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

importPokemonToJson();