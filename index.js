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
    const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${llmApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-flash-2.5", 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here are today's top gainers:\n${topGainers}` }
        ]
      })
    });

    const llmData = await llmResponse.json();

    // NEW: Check if the AI returned an error instead of a valid response
    if (!llmData.choices || !llmData.choices[0]) {
      console.error("❌ The LLM API returned an error:");
      console.error(JSON.stringify(llmData, null, 2));
      throw new Error("Failed to get a valid response from the LLM.");
    }

    const generatedContent = llmData.choices[0].message.content;

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
