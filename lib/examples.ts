export interface ExampleEntry {
  id: string;
  title: string;
  kind: string;
  origin: string;
  narration: string;
  image: string;
  audio: string;
  musicLabel?: string;
  music: string | null;
}

export const EXAMPLES: ExampleEntry[] = [
  {
    id: "diponegoro-submission",
    title: "The Submission of Prince Diponegoro to General De Kock",
    kind: "Nineteenth century",
    origin: "Java, Indonesia",
    narration: "This is The Submission of Prince Diponegoro to General De Kock, by Nicolaas Pieneman. Painted in the 1830s, it shows the prince taken into Dutch custody in 1830. This moment ended a five-year war in Java. At the center, the prince stands on the steps in flowing ivory white clothing. A woman kneels beside him and clings to him in grief. Close by, Dutch officers in deep blue uniforms stand firmly around him. On the far left, soldiers in brick red sit on horseback. To the right, a driver in a tall black hat waits on a carriage. In the foreground, a large crowd in warm cream, soft pink, and patterned cloth sits and stands quietly. Behind them, pale blue mountains rise under a calm morning sky. Overall, the mood feels solemn, quiet, and deeply tense.",
    image: "/examples/diponegoro-submission.jpg",
    audio: "/examples/diponegoro-submission.mp3",
    musicLabel: "Solemn Historical",
    music: "/bgm/solemn-historical.wav",
  },
  {
    id: "self-portrait-affandi",
    title: "Self-Portrait (Potret Diri)",
    kind: "Expressionism",
    origin: "Indonesia",
    narration: "This is Self-Portrait, a 1975 Expressionism painting by Affandi from Indonesia. A large head fills the center and almost the whole frame. The older man faces right in profile against a plain background. On the left, long wavy hair flows wildly behind his head. His white mustache and beard frame his mouth and chin below. His eyes are lowered, quiet and turned inward in deep thought. Thick paint swirls across his forehead, skin, hair, and beard. Affandi squeezed paint directly from tubes and shaped it by hand. That rough, raised texture makes aging feel intense, restless, and emotional. Light catches the ridges, turning still skin into visible, moving energy. Grey and white strands twist through darker hair with urgent movement. The close foreground leaves no distance between you and his reflection. You sense a lifetime held in one turned, weathered, expressive face.",
    image: "/examples/self-portrait-affandi.jpg",
    audio: "/examples/self-portrait-affandi.mp3",
    musicLabel: "Warm Portrait",
    music: "/bgm/warm-portrait.wav",
  },
  {
    id: "bull-hunt",
    title: "La Chasse au taureau sauvage (Bull Hunt)",
    kind: "Romanticism",
    origin: "Indonesia",
    narration: "This is Bull Hunt by Raden Saleh from Indonesia. He painted this Romanticism work in eighteen fifty-five. A huge black wild bull fills the center foreground. Tall dry grass brushes against its powerful legs and chest. The bull has thrown a rearing white horse toward the ground. A fallen rider lies helpless beside them in the center. On the left, a rider in green leans forward urgently. His galloping horse surges forward beneath him into bright light. A small brown dog watches tensely from the lower left corner. On the right, a rider in pink gallops closer with speed. Raised weapons rise above the rearing and galloping horses nearby. Behind them, open fields stretch toward calm mountains in the background. The foreground feels tense, chaotic, dangerous, and painfully frantic throughout. Soft distant light contrasts sharply with the violent central struggle.",
    image: "/examples/bull-hunt.jpg",
    audio: "/examples/bull-hunt.mp3",
    musicLabel: "Solemn Historical",
    music: "/bgm/solemn-historical.wav",
  },
  {
    id: "perjuangan-kemerdekaan",
    title: "Perjuangan Kemerdekaan (Revolution)",
    kind: "Realism / Indonesian Modern Art",
    origin: "Indonesia",
    narration: "This is Revolution by Sudiardjo, from Indonesian modern Realism. Sudiardjo painted it in 1945, when Indonesia proclaimed its independence. Without a battlefield, it presents revolution as a wall of faces. Larger faces fill the foreground below, smaller overlapping faces fill the background toward top and sides. At upper left a man wears a dark cap; top center another wears a blue cap. Beside him a young man has tousled hair; top right shows a woman in side profile. At center a woman with dark hair gazes, with a small child below her near bottom center. At lower left, a man wears glasses and a light cap. Near lower center, a bearded man watches beside a man with a mustache at lower right. Many fighters wear berets and military caps beneath handwritten words across the top. Soft light on textured faces leaves them solemn, weary, determined, watchful, quietly tense.",
    image: "/examples/perjuangan-kemerdekaan.jpg",
    audio: "/examples/perjuangan-kemerdekaan.mp3",
    musicLabel: "Solemn Historical",
    music: "/bgm/solemn-historical.wav",
  },
];
