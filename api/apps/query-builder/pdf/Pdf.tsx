import React from "react";
import {
  Document,
  Page,
  Text,
  StyleSheet,
  renderToStream,
  View,
  Link,
  Image,
} from "@react-pdf/renderer";
import JSZip from "jszip";
import Markdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const FONT_NORMAL = "Times-Roman";
const FONT_BOLD = "Times-Bold";
const FONT_ITALIC = "Times-Italic";
const MARGIN_BOTTOM = 12;
const FONT_SIZE = 14;

const styles = StyleSheet.create({
  body: {
    fontFamily: FONT_NORMAL,
    padding: 35,
  },
  p: {
    marginBottom: MARGIN_BOTTOM,
    fontSize: FONT_SIZE,
  },
  listItem: {
    marginBottom: MARGIN_BOTTOM,
    fontSize: FONT_SIZE,
  },
  link: {
    color: "blue",
    textDecoration: "underline",
  },
  title: {
    fontSize: 32,
    fontWeight: "medium",
    fontFamily: FONT_NORMAL,
    lineHeight: 1.3,
  },
  h1: {
    fontSize: 28,
    fontWeight: "normal",
    fontFamily: FONT_BOLD,
    marginBottom: MARGIN_BOTTOM,
  },
  h2: {
    fontSize: 25,
    fontWeight: "normal",
    fontFamily: FONT_BOLD,
    marginBottom: MARGIN_BOTTOM,
  },
  h3: {
    color: "#5C7080",
    fontSize: 17,
    fontWeight: "bold",
    fontFamily: FONT_BOLD,
    marginBottom: MARGIN_BOTTOM,
  },
  hr: {
    marginBottom: MARGIN_BOTTOM,
    borderBottomWidth: 1,
    borderBottomColor: "black",
  },
  strong: {
    fontFamily: FONT_BOLD,
    fontWeight: "bold",
  },
  italic: {
    fontFamily: FONT_ITALIC,
    fontStyle: "italic",
  },
  underline: {
    textDecoration: "underline",
  },
  strike: {
    textDecoration: "line-through",
  },
  code: {
    marginBottom: MARGIN_BOTTOM,
    fontSize: FONT_SIZE,
  },
  blockquote: {
    fontSize: FONT_SIZE,
    fontStyle: "italic",
    backgroundColor: "#F5F8FA",
    borderLeft: "5px solid #30404D",
    padding: 20,
    marginBottom: MARGIN_BOTTOM,
  },
  img: {
    marginBottom: MARGIN_BOTTOM,
  },
  pageNumber: {
    position: "absolute",
    fontSize: 12,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "grey",
  },
});

const components: Components = {
  del: ({ children }) => <Text style={styles.strike}>{children}</Text>,
  em: ({ children }) => <Text style={styles.italic}>{children}</Text>,
  strong: ({ children }) => <Text style={styles.strong}>{children}</Text>,
  a: ({ children, href }) => (
    <Link style={styles.link} src={href}>
      {children}
    </Link>
  ),
  hr: () => <View style={styles.hr}></View>,
  input: ({ checked }) => <Text>{checked ? "[x]" : "[ ]"}</Text>,
  ul: ({ children }) => <Text>{children}</Text>,
  li: ({ children }) => <Text style={styles.listItem}>{children}</Text>,
  ol: ({ children }) => <Text style={styles.listItem}>{children}</Text>,
  h1: ({ children }) => <Text style={styles.h1}>{children}</Text>,
  h2: ({ children }) => <Text style={styles.h2}>{children}</Text>,
  h3: ({ children }) => <Text style={styles.h3}>{children}</Text>,
  br: ({ children }) => <Text>{children}</Text>,
  code: ({ children }) => <Text style={styles.code}>{children}</Text>,
  blockquote: ({ children }) => (
    <View style={styles.blockquote}>{children}</View>
  ),
  p: ({ children }) => <Text style={styles.p}>{children}</Text>,
  img: ({ src }) => <Image style={styles.img} src={src} />,
};

type Props = {
  title: string;
  content: string;
};
export const createZip = async (files: Props[]) => {
  const zip = new JSZip();

  for (const file of files) {
    const title = JSON.parse(file.title);
    const content = JSON.parse(file.content);
    const formattedTitle = title.replace(/\.pdf$/, "");
    const stream = await renderToStream(
      <Pdf content={content} title={formattedTitle} />
    );
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);
    zip.file(title, pdfBuffer);
  }
  return zip;
};

export const Pdf: React.FC<Props> = ({ content, title }) => (
  <Document>
    <Page style={styles.body}>
      <View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View>
        <Markdown
          components={components}
          remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
        >
          {content}
        </Markdown>
      </View>
    </Page>
  </Document>
);
