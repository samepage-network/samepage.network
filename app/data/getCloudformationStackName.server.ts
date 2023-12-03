const getCloudformationStackName = (websiteUuid: string) =>
  `samepage-publishing-${websiteUuid}`;

export default getCloudformationStackName;
