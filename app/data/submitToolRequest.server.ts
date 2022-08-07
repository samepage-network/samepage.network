import sendEmail from "@dvargas92495/app/backend/sendEmail.server";

const submitToolRequest = ({
  email,
  tool,
  message,
}: {
  email: string;
  tool: string;
  message: string;
}): Promise<{ success: boolean }> => {
  return sendEmail({
    to: "support@samepage.network",
    from: "support@samepage.network",
    body: `User has requested ${tool} be added to the SamePage Network.\n\n${message}`,
    subject: "New tool request for SamePage",
    replyTo: email,
  }).then(() => ({
    success: true,
    message: "Successfully submitted tool request!",
  }));
};

export default submitToolRequest;
