module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const catboyGuild = client.guilds.cache.get('1508504155793133789');
    if (!catboyGuild || catboyGuild.memberCount < 1000) return;

    if (member.guild.id === '1490408248560324648') {
      const msg = `𓆩_ _                                                                                  𓆪
_ _                         [Femboy Cove :3](https://discord.gg/femboyss )

_ _   \`femboys\` \`safe space\`   \`ntox\`   \`twinks\`
_ _    \`giveaways \` \`events\`   \`Femboy tag\`
_ _
**𖹭 A fresh new discord server(🍬 since june 6/26 🍭)
𖹭 A server for femboys furries trans LGBTQ+ and everyone who
𖹭 Active chats and VCs
𖹭 Events and giveaways
𖹭 Kewl roles that fit you :3
𖹭 Fun/Economy bots
𖹭 Daily yaoi posts
𖹭 Partnerships!
𖹭 Kind staff members
𖹭 Sfw 14+**

## **OFFICIAL TWIN SERVER OF CATBOY COVE.**`;
      await member.send(msg).catch(() => {});
    } else if (member.guild.id === '1508504155793133789') {
      const msg = `ִ ⋆｡°✩ ۫  hullo!! you're invited to the land of cats!
﹒〔 friend group / social server.ᐟ

intros, art, media, selfies, femboy fit pics, confessions, venting, quotes, & more!
completely free of toxicity!
we got lots of members and could use more ^^

﹒〔 accepting of anyone, no matter what!
﹒〔 custom roles, bots, and channels for everyone!

✿◌ join for more info, we have intros!!! ^▽^
✦ . . ✦ . . ✦ . . ✦ . . ✦ .
ᵐᵉᵒʷ˜

dont gotta be a catboy to join :3
## **OFFICIAL TWIN SERVER OF FEMBOY COVE.**`;
      await member.send(msg).catch(() => {});
    }
  },
};
