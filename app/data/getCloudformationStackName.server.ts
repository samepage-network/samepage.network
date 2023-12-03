const getCloudformationStackName = (websiteUuid: string) =>
  `samepage-${websiteUuid}`;

export default getCloudformationStackName;
