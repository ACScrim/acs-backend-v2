import mongoose from 'mongoose';
import QuizQuestion, { IQuizQuestion } from '../src/models/QuizQuestion';
import * as path from "node:path";
import * as fs from "node:fs";

interface QuizFile {
  'catégorie-nom-slogan': {
    fr: {
      catégorie: string;
      nom: string;
      slogan: string;
    };
  };
  quizz: {
    fr?: {
      débutant?: Array<{
        id: number;
        question: string;
        propositions: string[];
        réponse: string;
        anecdote?: string;
      }>;
      confirmé?: Array<{
        id: number;
        question: string;
        propositions: string[];
        réponse: string;
        anecdote?: string;
      }>;
      expert?: Array<{
        id: number;
        question: string;
        propositions: string[];
        réponse: string;
        anecdote?: string;
      }>;
    };
  };
}

async function importQuizQuestions() {
  try {
    // Connexion à MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/acs-v2';
    await mongoose.connect(mongoUri);
    console.log('✓ Connexion à MongoDB réussie');

    // Répertoire contenant les fichiers JSON
    const questionsDir = path.join(__dirname, '../externaldata/questions');

    // Lire tous les fichiers JSON
    const files = fs.readdirSync(questionsDir)
      .filter(file => file.endsWith('.json'))
      .sort();

    console.log(`\n📁 ${files.length} fichiers trouvés`);

    let totalImported = 0;
    let skippedFiles = 0;

    // Traiter chaque fichier
    for (const file of files) {
      const filePath = path.join(questionsDir, file);

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as QuizFile;

        // Vérifier que le fichier a les données françaises
        if (!data['catégorie-nom-slogan']?.fr || !data.quizz?.fr) {
          skippedFiles++;
          continue;
        }

        const category = `${data['catégorie-nom-slogan'].fr.catégorie} - ${data['catégorie-nom-slogan'].fr.nom}`;

        // Collecter toutes les questions françaises
        const questions: IQuizQuestion[] = [];
        const allQuestions = [
          ...(data.quizz.fr.débutant || []),
          ...(data.quizz.fr.confirmé || []),
          ...(data.quizz.fr.expert || [])
        ];

        for (const q of allQuestions) {
          const quizQuestion: IQuizQuestion = {
            category,
            question: q.question,
            options: q.propositions,
            correctAnswer: q.réponse,
            anecdote: q.anecdote
          } as IQuizQuestion;

          questions.push(quizQuestion);
        }

        // Insérer les questions dans la base de données
        if (questions.length > 0) {
          const result = await QuizQuestion.insertMany(questions, { ordered: false }).catch(err => {
            // Ignorer les erreurs de doublons (unique constraint)
            if (err.code === 11000) {
              return [];
            }
            throw err;
          });

          totalImported += result.length;
          console.log(`  ✓ ${file}: ${questions.length} questions (${result.length} importées)`);
        }
      } catch (error) {
        console.error(`  ✗ Erreur lors du traitement de ${file}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`\n📊 Résultats:`);
    console.log(`  - Total importé: ${totalImported}`);
    console.log(`  - Fichiers ignorés: ${skippedFiles}`);

    await importPokemonQuestions();
    await importGameQuestions();

    await mongoose.connection.close();
    console.log('\n✓ Déconnexion de MongoDB réussie');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

async function importPokemonQuestions() {
  const pokemonData = JSON.parse(fs.readFileSync(path.join(__dirname, '../externaldata/pokemon_data.json'), 'utf-8')) as any[];
  const questions: IQuizQuestion[] = [];
  for(const p of pokemonData) {
    const question: IQuizQuestion = {
      category: "Pokémon",
      question: "Quel est ce Pokémon ?",
      options: [p.frName, ...shuffleArray(pokemonData.filter(pd => pd.frName !== p.frName).map(pd => pd.frName)).slice(0, 3)],
      correctAnswer: p.frName,
      image: p.sprites.other["official-artwork"].front_default || p.sprites.other.home.front_default || p.sprites.front_default,
    } as IQuizQuestion;
    questions.push(question);
  }

  try {
    const result = await QuizQuestion.insertMany(questions, { ordered: false }).catch(err => {
      // Ignorer les erreurs de doublons (unique constraint)
      if (err.code === 11000) {
        return [];
      }
      throw err;
    });
    console.log(`Importé ${result.length} questions Pokémon.`);
  } catch (error) {
    console.error('Erreur lors de l\'importation des questions Pokémon:', error);
  }
}

async function importGameQuestions() {
  const gamesCsvRaw = fs.readFileSync(path.join(__dirname, '../externaldata/games.csv'));
  const lines = gamesCsvRaw.toString().split('\n').filter(line => line.trim() !== '');
  const questions: IQuizQuestion[] = [];

  const start = 1;
  const amount = 500;
  let round = 0;

  do {
    console.log(`Round ${round}, starting at line ${start + round * amount} to ${amount + amount * round}`);
    const gamesData: { name: string, image: string }[] = lines.slice(start + round * amount, amount + amount * round).map(line => {
      const [name, background_image] = line.split(',').map(field => field.trim());
      return {name, image: background_image};
    });

    for (let i = 0; i < gamesData.length; i++) {
      const game = gamesData[i];
      if (!game.image || !game.image.startsWith('https://')) {
        continue;
      }
      const question: IQuizQuestion = {
        category: "Jeux Vidéo",
        question: "Quel est ce jeu vidéo ?",
        options: [game.name, ...shuffleArray(gamesData.filter(gd => gd.name !== game.name).map(gd => gd.name)).slice(0, 3)],
        correctAnswer: game.name,
        image: game.image || undefined,
      } as IQuizQuestion;
      questions.push(question);
    }
    console.log(questions.length + ' questions prêtes pour l\'importation.');
    round++;
  } while (questions.length < 4000);

  try {
    const result = await QuizQuestion.insertMany(questions, { ordered: false }).catch(err => {
      // Ignorer les erreurs de doublons (unique constraint)
      if (err.code === 11000) {
        return [];
      }
      throw err;
    });
    console.log(`Importé ${result.length} questions Jeux Vidéo.`);
  } catch (error) {
    console.error('Erreur lors de l\'importation des questions Jeux Vidéo:', error);
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

importQuizQuestions();

