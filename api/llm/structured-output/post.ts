import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";

type Params = {
  input: string;
  systemMessage: string;
  schema: any;
};
/**
 * This handler initializes and calls an OpenAI Functions powered
 * structured output chain. See the docs for more information:
 *
 * https://js.langchain.com/docs/modules/chains/popular/structured_output
 */
export const logic = async ({ input, systemMessage, schema }: Params) => {
  try {
    const openAIApiKey = process.env.OPENAI_API_KEY;
    if (!openAIApiKey) throw { message: "OpenAI Key is required", status: 400 };

    const prompt = new ChatPromptTemplate({
      promptMessages: [
        SystemMessagePromptTemplate.fromTemplate(systemMessage),
        HumanMessagePromptTemplate.fromTemplate("{inputText}"),
      ],
      inputVariables: ["inputText"],
    });
    const model = new ChatOpenAI({
      temperature: 0.8,
      modelName: "gpt-3.5-turbo",
      openAIApiKey,
    });
    const functionCallingModel = model.bind({
      functions: [
        {
          name: "output_formatter",
          description: "Should always be used to properly format output",
          parameters: schema,
        },
      ],
      function_call: { name: "output_formatter" },
    });
    const outputParser = new JsonOutputFunctionsParser();
    const chain = prompt.pipe(functionCallingModel).pipe(outputParser);
    const result = await chain.invoke({ inputText: input });
    console.log("result", result);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
      },
      body: JSON.stringify(result),
      isBase64Encoded: true,
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
