import createAPIGatewayHandler from "samepage/backend/createAPIGatewayProxyHandler";
import { zOauthRequest, zOauthResponse } from "samepage/internal/types";
import { z } from "zod";
import axios from "axios";

const logic = async (
  args: z.infer<typeof zOauthRequest>
): Promise<z.infer<typeof zOauthResponse>> => {
  const { data } = await axios
    .post<{ access_token: string }>(
      // TODO - REPLACE THIS WITH THE URL OF THE APP's OAUTH PROVIDER
      `https://api.samepage.network/oauth`,
      {
        code: args.code,
        redirect_uri:
          process.env.NODE_ENV === "production"
            ? "https://samepage.network/oauth/github"
            : "https://samepage.ngrok.io/oauth/github",
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    )
    .catch((e) =>
      Promise.reject(
        new Error(`Failed to get access token: ${e.response.data}`)
      )
    );
  const { access_token } = data;
  // @ts-ignore - TODO - REPLACE THIS WITH THE CODE TO GET THE WORKSPACE NAME
  const workspace = await getWorkspaceNameUsingAccessToken(access_token);
  return {
    accessToken: access_token,
    workspace,
  };
};

export default createAPIGatewayHandler(logic);
