import EmailLayout from "./EmailLayout";
import React from "react";
import Stripe from "stripe";

const SubscriptionUpdateEmail = ({
  email,
  id,
  status,
  feedback,
}: {
  email: string;
  id: string;
  status: Stripe.Subscription.Status;
  feedback?: Stripe.Subscription.CancellationDetails.Feedback;
}): React.ReactElement => (
  <EmailLayout>
    <div style={{ marginBottom: 16 }}>
      A recent customer ({email}) has updated their subscription to {status}
      {feedback ? ` with the following feedback: ${feedback}` : ""}. Click{" "}
      <a href={`https://dashboard.stripe.com/subscriptions/${id}`}>here</a> to
      see what happened.
    </div>
  </EmailLayout>
);

export default SubscriptionUpdateEmail;
