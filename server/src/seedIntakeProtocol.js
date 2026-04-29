/**
 * Seed Script: seedIntakeProtocol.js
 *
 * Seeds the 5 therapist-defined intake stage documents into the `intake_protocol` collection.
 * Each stage has opening questions and probe question sets in 4 languages:
 *   - Arabic/Darija (for LLM injection)
 *   - English  (dashboard labels + LLM fallback)
 *   - French   (French-speaking patients)
 *
 * Usage: node src/seedIntakeProtocol.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const INTAKE_PROTOCOL = [
  {
    stageNumber: 1,
    nameEn: 'Presenting Concern',
    nameAr: 'السبب الرئيسي للزيارة',
    nameFr: 'Motif Principal',
    goalEn: 'Understand what brought the patient here and their primary concern.',
    openingQuestionEn: "I'm glad you're here. To get started, could you tell me what brings you to seek support today?",
    openingQuestionAr: 'أهلاً بيك، سعيد/ة بيك هنا. نحب نفهمك أكثر — إيش هو اللي خلاك تجي اليوم؟',
    openingQuestionFr: "Je suis content(e) que vous soyez là. Pour commencer, pouvez-vous me dire ce qui vous amène à chercher du soutien aujourd'hui ?",
    probesEn: [
      "Can you tell me more about what has been happening?",
      "When did you first notice this concern?",
      "How would you describe what you are going through in your own words?"
    ],

    probesAr: [
      'تقدر/ي تحكيلي أكثر على اللي صاير معاك/ي؟',
      'متى بدأت تحس/ي بهذا الشي؟',
      'كيفاش تصف/ي اللي تعيشه/ي بكلامك/ي الخاص/ة؟'
    ],
    probesFr: [
      'Pouvez-vous m\'en dire plus sur ce qui se passe ?',
      'Depuis quand avez-vous remarqué ce problème ?',
      'Comment décririez-vous ce que vous traversez avec vos propres mots ?'
    ],
    maxTurns: 3
  },
  {
    stageNumber: 2,
    nameEn: 'Emotional Exploration',
    nameAr: 'استكشاف المشاعر',
    nameFr: 'Exploration Émotionnelle',
    goalEn: 'Explore the emotional landscape: feelings, intensity, triggers, and frequency.',
    openingQuestionEn: "Thank you for sharing that. Can you describe how this makes you feel emotionally?",
    openingQuestionAr: 'شكراً على اللي شاركتني/ه إياه. كيفاش تحس/ي بالضبط من ناحية المشاعر؟',
    openingQuestionFr: "Merci d'avoir partagé cela. Comment cela vous fait-il ressentir émotionnellement ?",
    probesEn: [
      'How intense would you say these feelings are on a scale from 1 to 10?',
      'Are there specific situations or people that trigger these feelings?',
      'How often do these feelings come up for you?'
    ],
    probesAr: [
      'على مقياس من 1 إلى 10، كيفاش تحدد/ي شدة هذه المشاعر؟',
      'فما مواقف أو أشخاص معيّنين يثيرون هذه المشاعر؟',
      'كيفاش بالأغلب تيجي عليك/ي هذه المشاعر — يومياً، أسبوعياً؟'
    ],
    probesFr: [
      'Sur une échelle de 1 à 10, quelle est l\'intensité de ces émotions ?',
      'Y a-t-il des situations ou des personnes qui déclenchent ces émotions ?',
      'À quelle fréquence ces émotions se manifestent-elles ?'
    ],
    maxTurns: 4
  },
  {
    stageNumber: 3,
    nameEn: 'History & Context',
    nameAr: 'التاريخ والسياق',
    nameFr: 'Historique et Contexte',
    goalEn: 'Understand when this began, any prior mental health history, and support systems.',
    openingQuestionEn: "To better understand your situation, I'd like to learn a bit about your background. How long have you been experiencing this?",
    openingQuestionAr: 'باش نفهمك/ي أكثر — مني وقت بدأت تحس/ي بهالشي؟',
    openingQuestionFr: "Pour mieux comprendre votre situation, depuis combien de temps traversez-vous cela ?",
    probesEn: [
      'Have you ever spoken with a therapist or counselor before?',
      'Is there anyone close to you who knows about what you\'re going through?',
      'Have you ever experienced something similar in the past?'
    ],
    probesAr: [
      'سبق وحكيت مع أخصائي نفسي أو مستشار من قبل؟',
      'فما شخص قريب منك/ي عارف/ة باللي تعيشه/ي؟',
      'عشت شي مشابه لهذا في الماضي؟'
    ],
    probesFr: [
      'Avez-vous déjà parlé à un thérapeute ou un conseiller auparavant ?',
      'Y a-t-il quelqu\'un de proche qui sait ce que vous traversez ?',
      'Avez-vous déjà vécu quelque chose de similaire dans le passé ?'
    ],
    maxTurns: 3
  },
  {
    stageNumber: 4,
    nameEn: 'Impact Assessment',
    nameAr: 'تقييم الأثر',
    nameFr: 'Évaluation de l\'Impact',
    goalEn: 'Assess how this is affecting daily functioning, sleep, relationships, and work.',
    openingQuestionEn: "I'd like to understand how this is affecting your daily life. How has it impacted things like your sleep or relationships?",
    openingQuestionAr: 'كيفاش هذا الشي يأثر على حياتك/ي اليومية — نومك/ي، علاقاتك/ي، شغلك/ي؟',
    openingQuestionFr: "Comment cela affecte-t-il votre vie quotidienne — votre sommeil, vos relations, votre travail ?",
    probesEn: [
      'How has your sleep been lately?',
      'Has this been affecting your work or studies?',
      'How have your relationships with family or friends been impacted?'
    ],
    probesAr: [
      'كيفاش نومك/ي هذه الأيام؟',
      'هل هذا يأثر على شغلك/ي أو دراستك/ي؟',
      'وكيفاش علاقاتك/ي مع العيلة والأصحاب؟'
    ],
    probesFr: [
      'Comment est votre sommeil ces derniers temps ?',
      'Est-ce que cela affecte votre travail ou vos études ?',
      'Quel est l\'impact sur vos relations familiales ou amicales ?'
    ],
    maxTurns: 3
  },
  {
    stageNumber: 5,
    nameEn: 'Closing & Safety Check',
    nameAr: 'الختام وضمان السلامة',
    nameFr: 'Clôture et Vérification de Sécurité',
    goalEn: 'Wrap up, validate the patient, confirm safety, and set expectations for the psychologist meeting.',
    openingQuestionEn: "Thank you so much for sharing all of this. Before we wrap up, I want to make sure you feel safe. Is there anything urgent you'd like me to pass on to your psychologist?",
    openingQuestionAr: 'شكراً جزيلاً على مشاركتك/ي لكل هذا. قبل ما ننهوا، نحب نضمن إنك/ي بخير — فما شي عاجل تحب/ي نوصله للمختص؟',
    openingQuestionFr: "Merci beaucoup d'avoir partagé tout cela. Avant de terminer, je veux m'assurer que vous vous sentez en sécurité. Y a-t-il quelque chose d'urgent à transmettre à votre psychologue ?",
    probesEn: [
      'Is there anything you feel we haven\'t covered that\'s important for your psychologist to know?',
      'How are you feeling right now compared to the start of our conversation?',
      'Do you feel safe at this moment?'
    ],
    probesAr: [
      'فما شي ما تكلمناش عليه وتحب/ي المختص يعرفه؟',
      'كيفاش تحس/ي دلوقتي مقارنة ببداية محادثتنا؟',
      'تحس/ي إنك/ي بخير وبأمان دلوقتي؟'
    ],
    probesFr: [
      'Y a-t-il quelque chose que nous n\'avons pas abordé et que votre psychologue devrait savoir ?',
      'Comment vous sentez-vous maintenant par rapport au début de notre conversation ?',
      'Vous sentez-vous en sécurité en ce moment ?'
    ],
    maxTurns: 2
  }
];

async function seedIntakeProtocol() {
  try {
    console.log('Connecting to MongoDB Atlas...');

    // The URI must include the DB name and generous timeout for standalone scripts
    const uri = process.env.MONGO_URI.includes('psych-platform.11bkmf9.mongodb.net/?')
      ? process.env.MONGO_URI.replace('/?', '/psych-platform?')
      : process.env.MONGO_URI;

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000
    });
    console.log('MongoDB connected.');

    const collection = mongoose.connection.db.collection('intake_protocol');


    // Clear existing protocol
    await collection.deleteMany({});
    console.log('Cleared existing intake_protocol documents.');

    // Insert fresh protocol
    await collection.insertMany(INTAKE_PROTOCOL);
    console.log(`✅ Seeded ${INTAKE_PROTOCOL.length} intake protocol stages.`);

    // Create index on stageNumber for fast lookups
    await collection.createIndex({ stageNumber: 1 }, { unique: true });
    console.log('✅ Index created on stageNumber.');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedIntakeProtocol();
