import React from "react";
import ReactDOM from "react-dom";
import ReactDOMServer from "react-dom/server";
import {
  FaTwitter,
  FaGithub,
  FaLinkedin,
  FaInstagram,
  FaFacebook,
  FaReddit,
  FaYoutube,
  FaMedium,
  FaTwitch,
  FaStrava,
  FaEnvelope,
  FaLink,
} from "react-icons/fa";
import ensureReact from "./ensureReact";
import ensureScript from "./ensureScript";
import { RenderFunction } from "./types";

type Props = {
  links: string[];
  copyright: string;
};

const icons = [
  { test: /twitter\.com/, component: <FaTwitter /> },
  { test: /github\.com/, component: <FaGithub /> },
  { test: /linkedin\.com/, component: <FaLinkedin /> },
  { test: /instagram\.com/, component: <FaInstagram /> },
  { test: /facebook\.com/, component: <FaFacebook /> },
  { test: /reddit\.com/, component: <FaReddit /> },
  { test: /youtube\.com/, component: <FaYoutube /> },
  { test: /medium\.com/, component: <FaMedium /> },
  { test: /twitch\.tv/, component: <FaTwitch /> },
  { test: /strava\.com/, component: <FaStrava /> },
  { test: /^mailto:/, component: <FaEnvelope /> },
  { test: /.*/, component: <FaLink /> },
];

const Footer = ({ links, copyright }: Props): React.ReactElement => {
  return (
    <>
      <style>
        {`.roamjs-footer {
  padding: 8px;
  flex-shrink: 0;
}

.roamjs-footer-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.roamjs-footer-social-networks {
  margin: 0 -8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0;
  list-style: none;
  justify-content: end;
  min-width: 40%;
}

.roamjs-footer-social-networks li {
  padding: 0 8px;
}

.roamjs-footer-copyright {
  min-width: 40%;
}

.roamjs-footer-icon {
  color: inherit;
  display: flex;
  flex: 0 0 auto;
}`}
      </style>
      <footer className={"roamjs-footer"}>
        <div className={"roamjs-footer-container"}>
          <span className={"roamjs-footer-copyright"}>
            © {new Date().getFullYear()} {copyright}
          </span>
          <span>
            Built with
            {` `}
            <a
              href="https://roamjs.com/extensions/static-site"
              target="_blank"
              rel="noreferrer"
            >
              RoamJS
            </a>
          </span>
          <ul className={"roamjs-footer-social-networks"}>
            {links.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer">
                  <span className={"roamjs-footer-icon"}>
                    {icons.find((i) => i.test.test(link))?.component}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
};

export const ID = "roamjs-footer";

if (process.env.CLIENT_SIDE) {
  ReactDOM.hydrate(
    <Footer {...(window.roamjsProps.footer as Props)} />,
    document.getElementById(ID)
  );
}

let cache = "";

export const render: RenderFunction = (dom, props) => {
  const componentProps = {
    links: props["links"] || [],
    copyright: props["copyright"][0] || "",
  };
  const innerHtml =
    cache ||
    (cache = ReactDOMServer.renderToString(<Footer {...componentProps} />));
  const { document } = dom.window;
  const { body, head } = document;
  const container = document.createElement("div");
  container.id = ID;
  body.appendChild(container);
  container.innerHTML = innerHtml;
  ensureReact(document);
  ensureScript("footer", componentProps, document, head);
};

export default Footer;
