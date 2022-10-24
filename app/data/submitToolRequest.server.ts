import invokeAsync from "./invokeAsync.server";

const submitToolRequest = ({
  email,
  tool,
  message,
}: {
  email: string;
  tool: string;
  message: string;
}): Promise<{ success: boolean }> => {
  return invokeAsync({
    path: "send-email",
    data: {
      to: "support@samepage.network",
      replyTo: email,
      subject: "New tool request for SamePage",
      bodyComponent: "tool-request",
      bodyProps: {
        tool,
        message,
      },
    },
  }).then(() => ({
    success: true,
    message: "Successfully submitted tool request!",
  }));
};

export default submitToolRequest;
