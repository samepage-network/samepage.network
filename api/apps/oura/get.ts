import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";

// https://cloud.ouraring.com/v2/docs

type ParamProps = {
  dataType: string;
  date: string;
  startDate: string;
  endDate: string;
  token: string;
};
const logic = async ({ dataType, endDate, startDate, token }: ParamProps) => {
  const url = `https://api.ouraring.com/v2/usercollection/${dataType}?start_date=${startDate}&end_date=${endDate}`;
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const errorData = await response.json();
      return { error: `API Error: ${errorData.message}` };
    }
    return await response.json();
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { error: `${error.name}: ${error.message}` };
    }
    return { error: "An unknown error occurred" };
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.*/],
});
