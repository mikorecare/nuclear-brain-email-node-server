const createdBy = { path: "createdBy", select: "email" };
const updatedBy = { path: "updatedBy", select: "email" };

const user = [createdBy, updatedBy];
const sort = { dateCreated: -1 };

export const populate = {
  audiences: (limit: number = 20, page: number = 1) => {
    return [
      ...user,
      {
        options: {
          limit,
          skip: limit * (page - 1),
          ...sort,
        },
        path: "subscribed",
      },
    ];
  },
  businessLists: [...user, { path: "owner", select: ["email"] }],
  businesses: [
    {
      path: "accountManager",
      select: ["email", "_id"],
    },
    {
      path: "businesses",
      populate: {
        model: "Users",
        path: "createdBy",
        select: ["email"],
      },
    },
  ],
  recipients: [
    ...user,
    {
      path: "subscribed",
      select: ["name"],
    },
    {
      path: "unsubscribed",
      select: ["name"],
    },
    {
      path: "sentCampaigns",
      select: ["dateCreated", "name", "type", "imageUrl"],
    },
    {
      path: "unsentCampaigns",
      select: ["dateCreated", "name", "type", "imageUrl"],
    },
  ],
  send: [
    {
      path: "subscribed",
      select: ["email"],
    },
  ],
  user,
};
