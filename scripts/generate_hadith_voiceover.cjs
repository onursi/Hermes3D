const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');

const outDir = 'C:\\Users\\User\\hermes-workspace\\youtube-hadith-bukhari-79\\audio';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const takes = [
  {
    filename: '01_prolog_regen.mp3',
    voice: 'de-DE-ConradNeural',
    rate: '-8%',
    pitch: '-4Hz',
    text: 'Das Gleichnis der Rechtleitung und des Wissens, mit denen Allah mich gesandt hat, ist wie der ergiebige Regen, der auf die Erde fiel.'
  },
  {
    filename: '02_akt1_fruchtbares_land.mp3',
    voice: 'de-DE-ConradNeural',
    rate: '-6%',
    pitch: '-2Hz',
    text: 'Ein Teil des Landes war fruchtbar und rein: Er nahm das Wasser auf und brachte üppiges Grün, Weideland und nährende Pflanzen hervor. Dies ist das Gleichnis jener, die das Wissen verstehen, verinnerlichen und andere lehren.'
  },
  {
    filename: '03_akt2_felsen_zisterne.mp3',
    voice: 'de-DE-ConradNeural',
    rate: '-6%',
    pitch: '-3Hz',
    text: 'Ein anderer Teil war trocken und undurchlässig, hielt aber das Wasser fest. Und Allah ließ die Menschen davon profitieren: Sie tranken daraus, tränkten ihre Tiere und bewässerten ihre Felder.'
  },
  {
    filename: '04_akt3_oedland_fels.mp3',
    voice: 'de-DE-ConradNeural',
    rate: '-7%',
    pitch: '-4Hz',
    text: 'Und ein dritter Teil war glatter Fels und Sand: Er hält kein Wasser und lässt kein Gras wachsen. Dies ist das Gleichnis jener, die sich abwenden und die Rechtleitung nicht annehmen.'
  },
  {
    filename: '05_epilog_herz.mp3',
    voice: 'de-DE-ConradNeural',
    rate: '-9%',
    pitch: '-5Hz',
    text: 'Wissen ist wie der Regen: Es fällt auf alle gleichermaßen. Doch was daraus entsteht, entscheidet allein der Boden deines Herzens.'
  },
  {
    filename: '06_arabisch_original.mp3',
    voice: 'ar-SA-HamedNeural',
    rate: '-5%',
    pitch: '-2Hz',
    text: 'مَثَلُ مَا بَعَثَنِي اللَّهُ بِهِ مِنَ الْهُدَى وَالْعِلْمِ كَمَثَلِ الْغَيْثِ الْكَثِيرِ أَصَابَ أَرْضًا، فَكَانَ مِنْهَا نَقِيَّةٌ قَبِلَتِ الْمَاءَ، فَأَنْبَتَتِ الْكَلأَ وَالْعُشْبَ الْكَثِيرَ.'
  }
];

async function run() {
  for (const take of takes) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(take.voice, OUTPUT_FORMAT.AUDIO_24KHZ_160KBITRATE_MONO_MP3);
    const filePath = path.join(outDir, take.filename);
    console.log(`Generating: ${take.filename} with voice ${take.voice}...`);
    const { audioStream } = tts.toStream(take.text, {
      rate: take.rate,
      pitch: take.pitch
    });
    const writeStream = fs.createWriteStream(filePath);
    audioStream.pipe(writeStream);
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      audioStream.on('error', reject);
    });
    console.log(`✓ Saved: ${filePath} (${fs.statSync(filePath).size} bytes)`);
  }
  console.log("All voiceover takes successfully generated!");
}

run().catch(err => {
  console.error("Error generating voiceover:", err);
  process.exit(1);
});
