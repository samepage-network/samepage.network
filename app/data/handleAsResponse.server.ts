const handleAsResponse = <T>(output: T, prefix?: string) =>
  Promise.resolve(output).catch((e) => {
    console.error(e);
    if (e instanceof Response) throw e;
    throw new Response(prefix ? `${prefix}:\n${e.message}` : e.message, {
      status: Number(e.status) || Number(e.code) || 500,
    });
  });

export default handleAsResponse;
