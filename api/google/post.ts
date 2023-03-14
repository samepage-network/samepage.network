import createAPIGatewayProxyHandler from "~/data/createAPIGatewayProxyHandler.server";

/** Creates a card with two widgets. */
const logic = async () => {
  return {
    action: {
      navigations: [
        {
          pushCard: {
            header: {
              title: "Tasks to work on:",
            },
            sections: [
              {
                widgets: [
                  {
                    textParagraph: {
                      text: "Title: " + "Edit Article",
                    },
                  },
                  {
                    textParagraph: {
                      text:
                        "Description: " +
                        "We need to edit some stuff for Substack",
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  };
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/^https:\/\/([\w]+\.)?google\.com/],
});
