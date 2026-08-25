// index.js
async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const llmApiKey = process.env.LLM_API_KEY;

  // 1. Fail early if secrets aren't set
  if (!alphaVantageKey || !llmApiKey) {
    console.error("Missing API keys. Please check GitHub Secrets.");
    process.exit(1);
  }

  try {
    console.log("1. Fetching market data from Alpha Vantage...");
    
    // Fetch the top gainers, losers, and most active tickers
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const avResponse = await fetch(avUrl);
    const marketData = await avResponse.json();

    if (!marketData.top_gainers) {
      throw new Error(`Alpha Vantage API error: ${JSON.stringify(marketData)}`);
    }

    // Format the top 3 gainers into a clean string for the LLM
    const topGainers = marketData.top_gainers.slice(0, 3).map(stock => 
      `${stock.ticker}: +${stock.change_percentage} (Volume: ${stock.volume})`
    ).join("\n");

    const systemPrompt = "You are a financial copywriter. Write a punchy, 2-sentence push notification update based on these top gaining stocks.";
    
    console.log("2. Generating content with AI...");

    // Using OpenRouter as an example for free/cheap LLM access (OpenAI-compatible)
   console.log("2. Generating content with AI...");

    // Using Google's Gemini API endpoint directly
   const llmResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
      method: "POST",
      headers: {
        "x-goog-api-key": llmApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nHere are today's top gainers:\n${topGainers}` }
            ]
          }
        ]
      })
    });

    const llmData = await llmResponse.json();

    // Check if Gemini returned an error instead of a valid response
    if (!llmData.candidates || !llmData.candidates[0]) {
      console.error("❌ The Gemini API returned an error:");
      console.error(JSON.stringify(llmData, null, 2));
      throw new Error("Failed to get a valid response from Gemini.");
    }

    // Extracting the text from Gemini's unique JSON structure
    const generatedContent = llmData.candidates[0].content.parts[0].text;

    console.log("\n=== AI GENERATED UPDATE ===");
    console.log(generatedContent);
    console.log("===========================\n");

    // 3. Next steps: Here is where you would POST the generatedContent 
    // to your free-tier database (Supabase/Firebase) or a push notification service.

  } catch (error) {
    console.error("Workflow failed:", error.message);
    process.exit(1);
  }
}

run();
