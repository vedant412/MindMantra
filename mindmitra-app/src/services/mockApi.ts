const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const MockApi = {
  getDailySummary: async () => {
    await delay(300);
    return {
      score: 72,
      state: "Balanced",
      insight: "You seemed a bit stressed in the evening..."
    };
  },
  
  getInsights: async () => {
    await delay(400);
    return {
      insights: [
        "Evenings seem a bit tougher for you.",
        "You feel better on days you're active.",
        "Work might be putting a bit of pressure on you lately."
      ]
    };
  },
  
  getActivities: async () => {
    await delay(200);
    return [
      { id: '1', title: 'Conscious Breath', category: 'Mind', duration: '5 min', color: '#FADCDC', icon: 'leaf' },
      { id: '2', title: 'Mind Detox', category: 'Mind', duration: '10 min', color: '#E8E3FA', icon: 'power' },
      { id: '3', title: 'Morning Walk', category: 'Body', duration: '15 min', color: '#D4F0F0', icon: 'walk' },
      { id: '4', title: 'Gratitude Notes', category: 'Reflect', duration: '10 min', color: '#D2E5EE', icon: 'book' }
    ];
  },
  
  processInput: async (text: string) => {
    await delay(1200); // Simulate API LLM processing lag
    return {
      response: "Yeah... taking a short break might be just what you need right now. Have you tried stepping away for a few minutes?",
      audio_url: null,
      confidence: 96
    };
  }
};
