// Authored test data. These are invented books and scores, never Qloo responses.
export const workshop = {
  boards:[{id:'worlds',name:'Other worlds'},{id:'city',name:'After-hours city'},{id:'nature',name:'The living world'}],
  candidates:[
    {id:'book-01',title:'A Map of Unwritten Cities',author:'Illustrative title',scores:[1000,40,40]},
    {id:'book-02',title:'The Last Train Is a Garden',author:'Illustrative title',scores:[40,1000,40]},
    {id:'book-03',title:'Field Notes from Tomorrow',author:'Illustrative title',scores:[390,390,500]},
    {id:'book-04',title:'The Orchard at the End of Time',author:'Illustrative title',scores:[350,100,420]},
    {id:'book-05',title:'The Quiet Atlas',author:'Illustrative title',scores:[300,300,300]},
    {id:'book-06',title:'Midnight in the Glasshouse',author:'Illustrative title',scores:[100,420,350]},
    {id:'book-07',title:'How the River Remembers',author:'Illustrative title',scores:[150,150,450]},
    {id:'book-08',title:'Postcards from Elsewhere',author:'Illustrative title',scores:[450,200,100]}
  ],slots:2,pinned:[],excluded:[]
};
export const workshopProvenance={mode:'illustrative-fixture',provider:'Authored test fixture',live_qloo:false,
  note:'All titles and scores in this workshop are invented to demonstrate the selection objective. They are not Qloo output or a measured product result.',
  score_rule:'Authored integer test scores; live mode will use 1000/rank rounded to the nearest integer.'};
