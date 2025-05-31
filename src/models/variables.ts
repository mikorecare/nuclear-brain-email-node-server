const { NODE_ENV } = process.env;
let { MONGODB_PASSWORD, MONGODB_USERNAME, MONGODB_DATABASE } = process.env;

if (NODE_ENV === "development") {
    MONGODB_PASSWORD = "";
    MONGODB_USERNAME = "";
}

if (typeof MONGODB_DATABASE === "undefined") {
    MONGODB_DATABASE = "emailserver";
}

const dateOptions = {
    timestamps: {
        createdAt: "dateCreated",
        updatedAt: "dateUpdated",
    },
};

const emailRegex = /[a-z0-9!#$%&"*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&"*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

export {
    dateOptions,
    emailRegex,
    MONGODB_DATABASE,
    MONGODB_PASSWORD,
    MONGODB_USERNAME
};
