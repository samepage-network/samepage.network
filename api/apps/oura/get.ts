import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";

// https://cloud.ouraring.com/v2/docs

type ParamProps = {
  dataType: string;
  date: string;
  startDate: string;
  endDate: string;
  token: string;
};
const logic = async ({
  dataType,
  date, // TODO - need more data
  endDate,
  startDate,
  token,
}: ParamProps) => {
  const url = `https://api.ouraring.com/v2/usercollection/${dataType}?start_date=${startDate}&end_date=${endDate}`;
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const response = await fetch(url, { method: "GET", headers });
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error };
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.*/],
});
