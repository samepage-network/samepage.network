import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { apiPost } from "package/internal/apiClient";

type Publication = {
  title: string;
  description: string;
};

export type RecentWorks = { publications: Publication[] };

export const RecentWorksGenerator = ({
  recentWorks,
  author,
}: {
  recentWorks: RecentWorks;
  author: string;
}) => {
  useEffect(() => {
    // Reset the moreInfo when the author changes
    setMoreInfo({});
  }, [author]);
  const [loadingInfo, setLoadingInfo] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [moreInfo, setMoreInfo] = useState<{ [key: number]: any }>({});
  const hasMoreInfo = (i: number) => {
    return moreInfo[i] !== undefined;
  };
  const fetchMoreInfo = async (index: number, title: string) => {
    setLoadingInfo((prev) => ({ ...prev, [index]: true }));
    try {
      const response = await apiPost({
        path: `google-books`,
        data: { title, author },
      });
      if (response.statusCode !== 200) {
        throw new Error("Failed to fetch more info");
      }
      const data = JSON.parse(response.body);

      // Default to the first result and update the state
      const bookInfo = data.items?.[0]?.volumeInfo; // Safely access the first item
      setMoreInfo((prev) => ({ ...prev, [index]: bookInfo }));
    } catch (error) {
      console.error("Error fetching more info:", error);
    }
    setLoadingInfo((prev) => ({ ...prev, [index]: false }));
  };

  const MoreInfoRow = (label: string, content: string) => {
    if (!content) return null;
    return (
      <>
        <div className="col-span-1 font-medium">{label}:</div>
        <div className="col-span-2 text-sm leading-6">{content}</div>
      </>
    );
  };

  return (
    <div className="container grid items-center px-4 text-left md:px-6">
      {recentWorks.publications.map((work, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Card title={work.title} className="p-4 my-2">
            <CardHeader>
              <CardTitle>{work.title}</CardTitle>
              <CardDescription>{work.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {moreInfo[i] && (
                <>
                  {moreInfo[i].imageLinks && (
                    <img
                      src={moreInfo[i].imageLinks.thumbnail}
                      alt="Book cover"
                      width={128}
                      height={198}
                    />
                  )}
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {MoreInfoRow("Author(s)", moreInfo[i].authors?.join(", "))}
                    {MoreInfoRow("Subtitle", moreInfo[i].subtitle)}
                    {MoreInfoRow("Published Date", moreInfo[i].publishedDate)}
                    {MoreInfoRow("Publisher", moreInfo[i].publisher)}
                    {MoreInfoRow("Description", moreInfo[i].description)}
                    <div className="col-span-1 font-medium">More Info:</div>
                    <div className="col-span-2 text-sm leading-6">
                      <Button variant={"outline"}>
                        <a
                          href={moreInfo[i].infoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open Google Books
                        </a>
                      </Button>
                    </div>
                  </dl>
                </>
              )}
              {!hasMoreInfo(i) && (
                <Button
                  onClick={() => fetchMoreInfo(i, work.title)}
                  disabled={loadingInfo[i]}
                  variant={"outline"}
                >
                  {loadingInfo[i] ? "Loading..." : "More Info"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
};
