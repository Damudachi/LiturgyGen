/**
 * Seed Prayers of the Faithful.
 *
 * The Advent Week 1 Wednesday entry is transcribed from the office's own
 * "Sample_readings.docx". Everything else is a working placeholder in the same
 * register, so a batch never renders an empty POTF block. They are marked
 * origin: "seed" - the office replaces them from the two General Intercessions
 * volumes (Fr. Albert Orillo, St Pauls) through the Template Manager.
 *
 * Matching is most-specific-first, so a season-level entry (week and day null)
 * is a catch-all for that season.
 */

const LORD_HEAR = 'Lord, hear our prayer.';

export const POTF_SEEDS = [
  /* ---------------------------------------------------------------- *
   * Advent
   * ---------------------------------------------------------------- */
  {
    title: 'Advent, Week 1 - Wednesday',
    season: 'Advent',
    week: 1,
    dayOfWeek: 'Wednesday',
    priestInvitation:
      'Advent teaches us to wait in confidence, for the Father has never failed to give his children what they truly need. Let us set our hopes before him.',
    responseOptions: [LORD_HEAR, 'Father, provide for your people.'],
    intentions: [
      'For the Church, that she may feed the faithful from the table of the word and of the Eucharist',
      'For those who govern, that the hunger of the poor may weigh on them until it is answered',
      'For everyone who feels empty in this season, that they may find Christ waiting for them',
      'For this school, that our Advent may be spent in real charity and not in waiting alone',
      'For our dead, that they may be seated at the banquet prepared from the foundation of the world',
    ],
    priestConclusion:
      'Father, you sustain us on a journey longer than we can see. Keep our steps in justice and peace until your Son returns. We make this prayer through Christ our Lord.',
    notes: 'Placeholder. Replaced by the office transcription when one is loaded.',
  },

  {
    title: 'Advent, Week 1 - any weekday',
    season: 'Advent',
    week: 1,
    dayOfWeek: null,
    priestInvitation:
      'As we begin our Advent journey, let us bring before the Father the hopes of our school and of the whole world, confident that he hears the prayer of those who wait for him.',
    responseOptions: [LORD_HEAR, 'Come, Lord Jesus, and hear us.'],
    intentions: [
      'For the Church, that this season of waiting may renew her longing for the coming of Christ',
      'For the leaders of nations, that they may prepare a way of justice and peace for their peoples',
      'For our campus community, that our studies and our service may make room for the Lord who comes',
      'For those who wait in sickness, loneliness or fear, that the nearness of God may comfort them',
      'For our departed loved ones, that they may see the light for which they hoped',
    ],
    priestConclusion:
      'Father of mercy, you never fail those who wait for you. Hear the prayers we offer at the beginning of this holy season. We ask this through Christ our Lord.',
  },
  {
    title: 'Advent, Week 2 - any weekday',
    season: 'Advent',
    week: 2,
    dayOfWeek: null,
    priestInvitation:
      'John the Baptist calls us to prepare the way of the Lord. Let us ask the Father to straighten the paths of our hearts and of our world.',
    responseOptions: [LORD_HEAR, 'Prepare our hearts, O Lord.'],
    intentions: [
      'For the Church, that she may be a clear voice calling our age to conversion',
      'For all who govern, that they may level the valleys of poverty and inequality in our land',
      'For teachers and students of this school, that our learning may prepare a way for truth',
      'For those burdened by sin or discouragement, that they may hear the good news of forgiveness',
      'For the faithful departed, that the Lord who comes may bring them to everlasting joy',
    ],
    priestConclusion:
      'God our Father, you sent John to prepare the way of your Son. Make us ready to receive him when he comes. We ask this through Christ our Lord.',
  },
  {
    title: 'Advent, Week 3 - any weekday',
    season: 'Advent',
    week: 3,
    dayOfWeek: null,
    priestInvitation:
      'The Lord is near, and the Church bids us rejoice. With glad hearts let us place our needs before the Father.',
    responseOptions: [LORD_HEAR, 'Lord, fill us with your joy.'],
    intentions: [
      'For the Church, that her joy in the nearness of Christ may be visible to the world',
      'For all who carry heavy burdens, that the coming of the Lord may lift their spirits',
      'For our Campus Ministry, that our celebrations may draw many closer to Christ',
      'For the poor of our country, that the joy of this season may reach them in real help',
      'For all who have died, that they may rejoice for ever in the presence of God',
    ],
    priestConclusion:
      'Father, you fill your people with gladness at the approach of your Son. Grant the prayers we make in joyful hope. Through Christ our Lord.',
  },
  {
    title: 'Advent, Week 4 - any weekday',
    season: 'Advent',
    week: 4,
    dayOfWeek: null,
    priestInvitation:
      'With Mary, who bore the Word in her womb, let us turn to the Father as the birth of his Son draws near.',
    responseOptions: [LORD_HEAR, 'Lord, come and save us.'],
    intentions: [
      'For the Church, that like Mary she may bring Christ to the world',
      'For all mothers, and for every child awaiting birth, that they may be cherished and protected',
      'For our school community, that we may welcome Christ in one another during these final days',
      'For families divided or far apart this Christmas, that the Lord may draw them together',
      'For the dead, that the Word made flesh may be their light',
    ],
    priestConclusion:
      'Father, as we come to the feast of the Nativity of your Son, hear the prayers of your waiting people. Through Christ our Lord.',
  },
  {
    title: 'Advent - any week (fallback)',
    season: 'Advent',
    week: null,
    dayOfWeek: null,
    priestInvitation:
      'Let us bring our needs to God our Father, who sent his Son to be our salvation, and who hears the prayers of those who watch for him.',
    responseOptions: [LORD_HEAR, 'Come, Lord Jesus, and hear us.'],
    intentions: [
      'For the Church throughout the world, that she may await the Lord with faith and courage',
      'For those who lead our nation, that they may work for justice and peace',
      'For our campus community, that this season may deepen our life of prayer',
      'For the sick, the lonely and the forgotten, that they may know the nearness of God',
      'For the faithful departed, that they may rest in the peace of Christ',
    ],
    priestConclusion:
      'Father, hear the prayers of your people who long for the coming of your Son. Through Christ our Lord.',
  },

  /* ---------------------------------------------------------------- *
   * Ordinary Time - one per weekday, plus a season fallback
   * ---------------------------------------------------------------- */
  {
    title: 'Ordinary Time - Monday',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: 'Monday',
    priestInvitation:
      'At the beginning of this week, let us place our work and our studies in the hands of the Father, who provides for all our needs.',
    responseOptions: [LORD_HEAR, 'Lord, bless the work of our hands.'],
    intentions: [
      'For the Church, that her ministers may begin this week strengthened by the Word they preach',
      'For all who return to work today, especially those whose labour is unseen or poorly paid',
      'For the students and teachers of this school, that this week may bear good fruit',
      'For those who begin the week in anxiety or discouragement, that they may find hope',
      'For our departed benefactors, that they may share in the reward of the just',
    ],
    priestConclusion:
      'Father, you call us each day to labour and to rest in you. Bless the week we now begin. Through Christ our Lord.',
  },
  {
    title: 'Ordinary Time - Tuesday',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: 'Tuesday',
    priestInvitation:
      'Trusting that our Father knows what we need before we ask, let us present the needs of the Church and of the world.',
    responseOptions: [LORD_HEAR, 'Lord, graciously hear us.'],
    intentions: [
      'For the Holy Father and all the bishops, that they may shepherd the Church with wisdom',
      'For our country, that honesty and integrity may mark our public life',
      'For our Campus Ministry Office and all who serve the liturgy, that their work may give glory to God',
      'For the sick of our community, and for those who care for them',
      'For all who have died, that they may come to the vision of God',
    ],
    priestConclusion:
      'Almighty Father, receive the prayers we offer in the name of your Son, who lives and reigns for ever and ever.',
  },
  {
    title: 'Ordinary Time - Wednesday',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: 'Wednesday',
    priestInvitation:
      'Gathered at the Table of the Word, let us ask the Father for the grace we need to live what we have heard.',
    responseOptions: [LORD_HEAR, 'Lord, hear the prayer of your people.'],
    intentions: [
      'For the Church, that she may be faithful to the Gospel she proclaims',
      'For all who make laws and administer justice, that they may defend the defenceless',
      'For our school, that faith and learning may grow together in every classroom',
      'For those who suffer from calamity, hunger or displacement, that they may find relief',
      'For the souls in purgatory, that they may soon behold the face of God',
    ],
    priestConclusion:
      'Father, your Word gives light to our path. Grant what we have asked in faith. Through Christ our Lord.',
  },
  {
    title: 'Ordinary Time - Thursday',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: 'Thursday',
    priestInvitation:
      'Mindful of the gift of the Eucharist, let us bring our petitions before God our Father.',
    responseOptions: [LORD_HEAR, 'Lord, feed us with your grace.'],
    intentions: [
      'For priests and for those called to the priesthood, that they may serve the altar with holiness',
      'For vocations to the religious life from our school and our parishes',
      'For the leaders of nations, that they may seek peace before every other good',
      'For those who hunger for bread and for those who hunger for meaning',
      'For all the faithful departed, that they may share in the eternal banquet',
    ],
    priestConclusion:
      'Father, you nourish us with the Body and Blood of your Son. Hear the prayers of those you have fed. Through Christ our Lord.',
  },
  {
    title: 'Ordinary Time - Friday',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: 'Friday',
    priestInvitation:
      'On this day when we remember the Cross of our Lord, let us bring to the Father the sufferings of the world.',
    responseOptions: [LORD_HEAR, 'By your Cross, Lord, hear us.'],
    intentions: [
      'For the Church, that she may never be ashamed of the Cross of Christ',
      'For all who are persecuted for their faith, that they may stand firm',
      'For the sick, the dying and all who keep watch beside them',
      'For our campus community, that we may take up our daily crosses with love',
      'For those who have died this week, that they may rise with Christ',
    ],
    priestConclusion:
      'Father, through the Cross of your Son you brought life to the world. Hear the prayers of the people he redeemed. Through Christ our Lord.',
  },
  {
    title: 'Ordinary Time - Saturday',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: 'Saturday',
    priestInvitation:
      'With the Blessed Virgin Mary, whom the Church honours on this day, let us present our prayers to the Father.',
    responseOptions: [LORD_HEAR, 'Through the prayers of Mary, hear us.'],
    intentions: [
      'For the Church, that she may imitate the faith and obedience of the Mother of God',
      'For all families, that they may be homes of prayer and peace',
      'For our school, that Mary may guide our students in wisdom and purity of heart',
      'For those who have no one to pray for them',
      'For the faithful departed, that Mary may lead them to her Son',
    ],
    priestConclusion:
      'Father, you gave us the Mother of your Son to be our mother also. Hear the prayers we make through her intercession. Through Christ our Lord.',
  },
  {
    title: 'Ordinary Time - Sunday',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: 'Sunday',
    priestInvitation:
      'On this day of the Resurrection, let us lift up the needs of the Church and of the world to God our Father.',
    responseOptions: [LORD_HEAR, 'Risen Lord, hear our prayer.'],
    intentions: [
      'For the Church gathered throughout the world on this Lord’s Day',
      'For all in public office, that they may serve the common good',
      'For our campus community, that the Sunday Eucharist may be the centre of our week',
      'For the poor, the sick and the sorrowing among us',
      'For all who have died, that they may share in the risen life of Christ',
    ],
    priestConclusion:
      'Father, on this day your Son rose from the dead. Hear the prayers of the people who rejoice in his victory. Through Christ our Lord.',
  },
  {
    title: 'Ordinary Time - any day (fallback)',
    season: 'Ordinary Time',
    week: null,
    dayOfWeek: null,
    priestInvitation:
      'Let us bring our needs and the needs of the whole world to God our Father, who hears every prayer offered in the name of his Son.',
    responseOptions: [LORD_HEAR, 'Lord, graciously hear us.'],
    intentions: [
      'For the Church, that she may be a sign of hope for all peoples',
      'For those who govern, that they may work for justice and peace',
      'For our school community, that we may grow in faith, knowledge and service',
      'For the sick, the suffering and the forgotten',
      'For the faithful departed, that they may rest in the peace of Christ',
    ],
    priestConclusion:
      'Father, you hear the prayers of those who trust in you. Grant what we ask according to your will. Through Christ our Lord.',
  },

  /* ---------------------------------------------------------------- *
   * Other seasons - single fallbacks, replaced from the Proper volume
   * ---------------------------------------------------------------- */
  {
    title: 'Christmas Time - any day (fallback)',
    season: 'Christmas',
    week: null,
    dayOfWeek: null,
    priestInvitation:
      'The Word has been made flesh and dwells among us. With joy let us ask the Father for the gifts we need.',
    responseOptions: [LORD_HEAR, 'Word made flesh, hear us.'],
    intentions: [
      'For the Church, that she may proclaim the joy of the Nativity to every nation',
      'For all children, especially those born into poverty or danger',
      'For families gathered and families separated during these holy days',
      'For our campus community, that Christ may be born anew in our hearts',
      'For the dead, that the light of Christmas may shine upon them',
    ],
    priestConclusion:
      'Father, in the birth of your Son you have shown us your love. Hear the prayers of your rejoicing people. Through Christ our Lord.',
  },
  {
    title: 'Lent - any day (fallback)',
    season: 'Lent',
    week: null,
    dayOfWeek: null,
    priestInvitation:
      'In this season of prayer, fasting and almsgiving, let us turn to the Father with humble and contrite hearts.',
    responseOptions: [LORD_HEAR, 'Lord, have mercy on us.'],
    intentions: [
      'For the Church, that this Lent may renew her in holiness',
      'For those preparing for Baptism at Easter, that they may persevere',
      'For all who govern, that they may hear the cry of the poor',
      'For our school community, that our Lenten sacrifices may bear fruit in charity',
      'For the faithful departed, that they may be cleansed of every sin',
    ],
    priestConclusion:
      'Merciful Father, you never turn away from a humble heart. Hear the prayers of your people in this holy season. Through Christ our Lord.',
  },
  {
    title: 'Paschal Triduum - any day (fallback)',
    season: 'Triduum',
    week: null,
    dayOfWeek: null,
    priestInvitation:
      'In these most holy days, let us pray to the Father who gave up his Son for the life of the world.',
    responseOptions: [LORD_HEAR, 'By your Passion, Lord, hear us.'],
    intentions: [
      'For the holy Church of God, redeemed by the Blood of Christ',
      'For all who suffer injustice, torture or imprisonment',
      'For those who will be baptised at the Easter Vigil',
      'For our campus community, keeping watch with the Lord in these days',
      'For all who have died, that they may pass with Christ from death to life',
    ],
    priestConclusion:
      'Father, in the Passion and Death of your Son you have reconciled the world to yourself. Hear our prayers. Through Christ our Lord.',
  },
  {
    title: 'Easter Time - any day (fallback)',
    season: 'Easter',
    week: null,
    dayOfWeek: null,
    priestInvitation:
      'Christ is risen and lives for ever. With Easter joy let us make our prayer to the Father.',
    responseOptions: [LORD_HEAR, 'Risen Lord, hear our prayer.'],
    intentions: [
      'For the Church, that she may bear witness to the Resurrection with courage',
      'For the newly baptised, that they may walk in newness of life',
      'For all who despair, that the risen Christ may bring them hope',
      'For our school community, that we may live as an Easter people',
      'For those who have died, that they may rise with Christ in glory',
    ],
    priestConclusion:
      'Father, by raising your Son you opened for us the gate of eternal life. Hear the prayers of your Easter people. Through Christ our Lord.',
  },
  {
    title: 'Solemnities, Feasts and Memorials (fallback)',
    season: 'Feast',
    week: null,
    dayOfWeek: null,
    priestInvitation:
      'As we keep this celebration, let us join our prayers to those of the saints and present our needs to God our Father.',
    responseOptions: [LORD_HEAR, 'Lord, graciously hear us.'],
    intentions: [
      'For the Church, that the example of the saints may lead her in the way of holiness',
      'For all who bear public responsibility, that they may govern with wisdom',
      'For our school community, honouring today the memory of the saints',
      'For the sick, the poor and all who ask for our prayers',
      'For the faithful departed, that they may join the company of the saints in glory',
    ],
    priestConclusion:
      'Father, you are glorified in the assembly of your saints. Hear the prayers we make in their company. Through Christ our Lord.',
  },
];

export default POTF_SEEDS;
