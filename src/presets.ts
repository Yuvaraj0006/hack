import { PresetExample } from "./types";

export const PRESET_EXAMPLES: PresetExample[] = [
  {
    title: "Polite Blog Post Assistant",
    category: "Writing",
    description: "Contains heavy polite phrasing, greeting, and conversational filler.",
    mode: "balanced",
    prompt: `Hello there! I hope you are having a wonderful day. I would really appreciate it if you could help me write a blog post. I want to publish a post on my website about the importance of getting enough sleep every night. Could you please make sure it is written in a very friendly, professional, and informative tone? Also, I would really like it if you could make sure it has five main tips for sleeping better. It should be about 500 words long. Thank you so very much, you are the best!`
  },
  {
    title: "Over-explained Coding Help",
    category: "Coding",
    description: "Contains personal backstory and repetitive formatting requests.",
    mode: "aggressive",
    prompt: `I am currently trying to learn how to code in React and I am working on a simple project for a local client of mine. I have this component and I'm really struggling to get the state to update correctly. What I want you to do is to look at the code below, analyze it completely, find any possible bugs, and tell me where I went wrong. Please explain it in super simple terms because as I said, I am still a beginner and complex terms confuse me. Also, please show me the correct code. Here is the code:

function Counter() {
  const [count, setCount] = useState(0);
  const handleIncrement = () => {
    count = count + 1;
    setCount(count);
  }
  return <button onClick={handleIncrement}>{count}</button>
}`
  },
  {
    title: "Wordy Meeting Summarizer",
    category: "Business",
    description: "Contains redundant specifications and conversational instructions.",
    mode: "conservative",
    prompt: `Below is a transcript from our weekly team sync meeting that we held on Monday morning. I need you to go through the entire text carefully, read every single line, and then write a comprehensive, detailed summary of everything that was discussed by the team. I specifically need you to highlight the key decisions made, who is responsible for which action items, and any upcoming deadlines. Please do not omit any important details or names, because our manager will read this and she needs to know exactly what is going on. Make it very structured and professional.`
  }
];
