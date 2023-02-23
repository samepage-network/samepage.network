import React from "react";
import getMeta from "~/data/getMeta.server";
import Title from "~/components/Title";
import Subtitle from "~/components/Subtitle";
import ExternalLink from "~/components/ExternalLink";

const P = ({ children }: React.PropsWithChildren) => (
  <p className="my-2">{children}</p>
);

const PrivacyPolicyPage: React.FunctionComponent = () => (
  <div className="w-full max-w-2xl">
    <Title>Privacy Policy for SamePage Network, Inc.</Title>
    <P>
      At SamePage Network, Inc, one of our main priorities is the privacy of our
      visitors. This Privacy Policy document contains types of information that
      is collected and recorded by SamePage and how we use it.
    </P>
    <P>
      If you have additional questions or require more information about our
      Privacy Policy, do not hesitate to{" "}
      <ExternalLink href={"/contact"}>contact us</ExternalLink>.
    </P>
    <P>
      This Privacy Policy applies only to our online activities and is valid for
      visitors to our website with regards to the information that they shared
      and/or collect in our website and extensions. This policy is not
      applicable to any information collected offline or via channels other than
      these software. Our Privacy Policy was created with the help of the Free
      Privacy Policy Generator.
    </P>
    <Subtitle className="mt-6">Consent</Subtitle>
    <P>
      By using our website, protocol, and extensions, you hereby consent to our
      Privacy Policy and agree to its terms. For our Terms and Conditions,
      please visit the{" "}
      <ExternalLink href={"/terms-of-use"}>Terms Of Use</ExternalLink>.
    </P>
    <Subtitle className="mt-6">Information we collect</Subtitle>
    <P>
      The personal information that you are asked to provide, and the reasons
      why you are asked to provide it, will be made clear to you at the point we
      ask you to provide your personal information.
    </P>
    <P>
      If you contact us directly, we may receive additional information about
      you such as your name, email address, phone number, the contents of the
      message and/or attachments you may send us, and any other information you
      may choose to provide.
    </P>
    <P>
      When you register for an Account, we may ask for your contact information,
      including items such as name, email address, and telephone number.
    </P>
    <Subtitle className="mt-6">How we use your information</Subtitle>
    <P>We use the information we collect in various ways, including to:</P>
    <ul className="list-disc pl-8">
      <li>Provide, operate, and maintain our websites</li>
      <li>Improve, personalize, and expand our websites</li>
      <li>Understand and analyze how you use our websites</li>
      <li>Develop new products, services, features, and functionality</li>
      <li>
        Communicate with you, either directly or through one of our partners,
        including for customer service, to provide you with updates and other
        information relating to the webste, and for marketing and promotional
        purposes
      </li>
      <li>Send you emails</li>
      <li>Find and prevent fraud</li>
    </ul>
    <Subtitle className="mt-6">Log Files</Subtitle>
    <P>
      SamePage follows a standard procedure of using log files. These files log
      visitors when they visit websites. All hosting companies do this and a
      part of hosting services' analytics. The information collected by log
      files include date and time stamp. These are not linked to any information
      that is personally identifiable. The purpose of the information is for
      analyzing trends and administering the site.
    </P>
    <Subtitle className="mt-6">Cookies and Web Beacons</Subtitle>
    <P>
      Like any other website, SamePage uses 'cookies'. These cookies are used to
      store information including visitors' preferences, and the pages on the
      website that the visitor accessed or visited. The information is used to
      optimize the users' experience by customizing our web page content based
      on visitors' browser type and/or other information.
    </P>
    <P>
      For more general information on cookies, please read "What Are Cookies"
      from Cookie Consent.
    </P>
    <Subtitle className="mt-6">Third Party Privacy Policies</Subtitle>
    <P>
      SamePage's Privacy Policy does not apply to other websites. Thus, we are
      advising you to consult the respective Privacy Policies of these
      third-party servicers for more detailed information. It may include their
      practices and instructions about how to opt-out of certain options.
    </P>
    <P>
      You can choose to disable cookies through your individual browser options.
      To know more detailed information about cookie management with specific
      web browsers, it can be found at the browsers' respective websites.
    </P>
    <Subtitle className="mt-6">CCPA Privacy Rights</Subtitle>
    <P>
      Under the CCPA, among other rights, California consumers have the right
      to:
    </P>
    <ul>
      <li>
        Request that a business that collects a consumer's personal data
        disclose the categories and specific pieces of personal data that a
        business has collected about consumers.
      </li>

      <li>
        Request that a business delete any personal data about the consumer that
        a business has collected.
      </li>

      <li>
        Request that a business that sells a consumer's personal data, not sell
        the consumer's personal data.
      </li>
    </ul>
    <P>
      If you make a request, we have one month to respond to you. If you would
      like to exercise any of these rights, please contact us.
    </P>
    <Subtitle className="mt-6">GDPR Data Protection Rights</Subtitle>
    <P>
      We would like to make sure you are fully aware of all of your data
      protection rights. Every user is entitled to the following:
    </P>
    <ul>
      <li>
        The right to access - You have the right to request copies of your
        personal data. We may charge you a small fee for this service.
      </li>
      <li>
        The right to rectification - You have the right to request that we
        correct any information you believe is inaccurate. You also have the
        right to request that we complete the information you believe is
        incomplete.
      </li>
      <li>
        The right to erasure - You have the right to request that we erase your
        personal data, under certain conditions.
      </li>
      <li>
        The right to restrict processing - You have the right to request that we
        restrict the processing of your personal data, under certain conditions.
      </li>
      <li>
        The right to object to processing - You have the right to object to our
        processing of your personal data, under certain conditions.
      </li>
      <li>
        The right to data portability - You have the right to request that we
        transfer the data that we have collected to another organization, or
        directly to you, under certain conditions.
      </li>
    </ul>
    <P>
      If you make a request, we have one month to respond to you. If you would
      like to exercise any of these rights, please contact us.
    </P>
    <Subtitle className="mt-6">Children's Information</Subtitle>
    <P>
      Another part of our priority is adding protection for children while using
      the internet. We encourage parents and guardians to observe, participate
      in, and/or monitor and guide their online activity.
    </P>
    <P>
      RoamJS does not knowingly collect any Personal Identifiable Information
      from children under the age of 13. If you think that your child provided
      this kind of information on our website, we strongly encourage you to
      contact us immediately and we will do our best efforts to promptly remove
      such information from our records.
    </P>
  </div>
);

export const Head = getMeta({ title: "Privacy Policy" });

export default PrivacyPolicyPage;
