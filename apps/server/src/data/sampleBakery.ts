// The "Sweet Crumbs Bakery" sample content — greeting, visitors with a conversation in each state, and
// saved replies. One source for the development seed (scripts/seed.ts) and for the private workspace every
// homepage visitor gets (services/demo.service.ts), so the two can't drift apart.
type SampleMessage = { from: "visitor" } | { from: "agent"; agent: string };

export type SampleConversation = {
    status: "unassigned" | "assigned" | "resolved";
    agent?: string;
    messages: Array<SampleMessage & { body: string }>;
    note?: { author: string; body: string };
};

export type SampleVisitor = { name: string; email: string; page: string; conversation?: SampleConversation };

export const SAMPLE_BAKERY = {
    name: "Sweet Crumbs Bakery",
    widgetColor: "#B8285F",
    greeting: "Hi, how can we help?",
    awayMessage: "We're baking right now — leave your email and we'll get back to you.",
    visitors: [
        {
            name: "Alice Wong",
            email: "alice@example.test",
            page: "https://sweetcrumbs.test/cakes",
            conversation: {
                status: "assigned",
                agent: "tom",
                messages: [
                    { from: "visitor", body: "Hi, do you take custom cake orders?" },
                    { from: "agent", agent: "tom", body: "Hello Alice! We do. What size and flavour are you thinking of?" },
                    { from: "visitor", body: "A two-tier chocolate cake for Saturday, nut-free please." },
                ],
                note: { author: "tom", body: "Severe walnut allergy — use the nut-free kitchen." },
            },
        },
        {
            name: "Bob Rao",
            email: "bob@example.test",
            page: "https://sweetcrumbs.test/delivery",
            conversation: {
                status: "unassigned",
                messages: [{ from: "visitor", body: "Do you deliver to Gajuwaka?" }],
            },
        },
        {
            name: "Chitra Nair",
            email: "chitra@example.test",
            page: "https://sweetcrumbs.test/",
            conversation: {
                status: "resolved",
                agent: "emma",
                messages: [
                    { from: "visitor", body: "Which croissant is freshest this afternoon?" },
                    { from: "agent", agent: "emma", body: "The almond ones came out of the oven at 2 pm." },
                    { from: "visitor", body: "Perfect, thank you!" },
                ],
            },
        },
    ] satisfies SampleVisitor[],
    savedReplies: [
        { shortcut: "hours", title: "Opening hours", body: "We're open Monday to Saturday, 7 am to 6 pm, and Sunday 8 am to 3 pm." },
        { shortcut: "delivery", title: "Delivery", body: "We deliver within 10 km. Orders placed before 10 am arrive by 1 pm." },
        { shortcut: "cakes", title: "Custom cakes", body: "Custom cakes need 48 hours notice. Tell us the size, flavour and any allergies." },
    ],
};
