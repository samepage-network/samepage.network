import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";

export const runtime = "edge";

export const logic = async ({
  title,
  author,
}: {
  title: string;
  author: string;
}) => {
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (!apiKey) throw new Error("Google Books API key is not set.");

    const params = new URLSearchParams({
      q: `intitle:${title}+inauthor:${author}`,
      langRestrict: "en",
      orderBy: "relevance",
      key: apiKey,
    });

    const url = `https://www.googleapis.com/books/v1/volumes?${params}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(
        `API call failed with status: ${response.status}, Details: ${errorDetails}`
      );
    }
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify(e),
    };
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.+/],
});
