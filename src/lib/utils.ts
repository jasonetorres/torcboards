import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// --- UPDATED FUNCTION ---
export function getRandomQuote() {
  const quotes = [
    // Original Quotes
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.", author: "Steve Jobs" },
    { text: "Success is not final, failure is not fatal: It is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
    { text: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Opportunities don't happen, you create them.", author: "Chris Grosser" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { text: "Whether you think you can or you think you can’t, you’re right.", author: "Henry Ford" },
    { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { text: "The obstacle is the path.", author: "Zen Proverb" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Your attitude, not your aptitude, will determine your altitude.", author: "Zig Ziglar" },
    { text: "There is no substitute for hard work.", author: "Thomas Edison" },
    { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
    { text: "Growth is never by mere chance; it is the result of forces working together.", author: "James Cash Penney" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Our greatest glory is not in never falling, but in rising up every time we fail.", author: "Ralph Waldo Emerson" }, // Note: Similar author, different quote
    { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
    { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
    { text: "If you don't like something, change it. If you can't change it, change your attitude.", author: "Maya Angelou" },
    { text: "By failing to prepare, you are preparing to fail.", author: "Benjamin Franklin" },
    { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Only those who will risk going too far can possibly find out how far one can go.", author: "T.S. Eliot" },
    { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
    { text: "Setting goals is the first step in turning the invisible into the visible.", author: "Tony Robbins" },
    { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
    { text: "Persistence guarantees that results are inevitable.", author: "Paramahansa Yogananda" },
    { text: "All our dreams can come true, if we have the courage to pursue them.", author: "Walt Disney" }, // Note: Duplicate author
    { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
    { text: "It's not the destination, it's the journey.", author: "Ralph Waldo Emerson" }, // Note: Duplicate author
    { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", author: "Ralph Waldo Emerson" }, // Note: Duplicate author
    { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" }, // Note: Duplicate author
    { text: "The only thing worse than being blind is having sight but no vision.", author: "Helen Keller" },
    { text: "Creativity is intelligence having fun.", author: "Albert Einstein" }, // Note: Duplicate author
    { text: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
    { text: "Continuous improvement is better than delayed perfection.", author: "Mark Twain" }, // Note: Duplicate author
    { text: "I am not a product of my circumstances. I am a product of my decisions.", author: "Stephen R. Covey" },
    { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" }, // Note: Duplicate author
    { text: "It's hard to beat a person who never gives up.", author: "Babe Ruth" },
    { text: "Keep your face always toward the sunshine—and shadows will fall behind you.", author: "Walt Whitman" },
    { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" }, // Note: Duplicate author
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "Either you run the day or the day runs you.", author: "Jim Rohn" }, // Note: Duplicate author
    { text: "Build your own dreams, or someone else will hire you to build theirs.", author: "Farraj Gray" }
  ];
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
}
// --- END OF FUNCTION ---