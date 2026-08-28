
const $ = (sel) => document.querySelector(sel);
const sceneEl = $("#scene");
const bgEl = $("#bg");
const hud = $("#hud");
const autonomyValue = $("#autonomyValue");
const autonomyBar = $("#autonomyBar");
const audioBtn = $("#audioBtn");
const restartBtn = $("#restartBtn");
const subtitle = $("#subtitle");
const toast = $("#toast");

const sounds = {
  rain: $("#rain"),
  room: $("#roomTone"),
  page: $("#pageTurn"),
  pen: $("#penScratch"),
  latch: $("#latch"),
  steps: $("#footsteps"),
};
sounds.rain.volume = .22;
sounds.room.volume = .18;
sounds.page.volume = .42;
sounds.pen.volume = .5;
sounds.latch.volume = .5;
sounds.steps.volume = .28;

const HOBBIES = [
  ["workout","Sports / working out","physical"],
  ["gaming","Gaming","mental"],
  ["outdoors","Fishing / hunting / outdoors","outdoor"],
  ["music","Music","creative"],
  ["art","Art / creating","creative"],
  ["reading","Reading","mental"],
  ["friends","Hanging out with friends","social"],
  ["alone","Being alone / decompressing","solitary"],
];

let state = {
  scene: 0,
  name: "",
  hobby: null,
  firstChoice: null,
  autonomy: 100,
  overrides: 0,
  concealed: 0,
  reframed: 0,
  doctorQuestions: [],
  choices: {},
  audioOn: true,
  audioUnlocked: false,
  reflections: {reliability:"", setting:""},
  tasks: {},
};

function save(){ localStorage.setItem("caseFile1892", JSON.stringify(state)); }
function clearSave(){ localStorage.removeItem("caseFile1892"); }
function safeName(){ return (state.name || "PATIENT").replace(/[<>&"]/g,""); }
function hobbyLabel(){ return state.hobby ? state.hobby[1] : "something you enjoy"; }

function setBg(kind){
  bgEl.className = `bg bg-${kind}`;
}
function play(name){
  if(!state.audioOn || !state.audioUnlocked) return;
  const a = sounds[name];
  if(!a) return;
  try{ a.currentTime=0; a.play(); }catch(e){}
}
function ambient(kind){
  if(!state.audioUnlocked) return;
  const rainOn = ["bed","wallpaper"].includes(kind);
  const roomOn = ["office","corridor","archive"].includes(kind);
  sounds.rain.volume = state.audioOn && rainOn ? .22 : 0;
  sounds.room.volume = state.audioOn && roomOn ? .18 : 0;
  if(sounds.rain.paused) sounds.rain.play().catch(()=>{});
  if(sounds.room.paused) sounds.room.play().catch(()=>{});
}
function unlockAudio(){
  state.audioUnlocked = true;
  Object.values(sounds).forEach(a=>{
    a.play().then(()=>{ if(a!==sounds.rain && a!==sounds.room){a.pause();a.currentTime=0;} }).catch(()=>{});
  });
  if(sounds.rain.paused) sounds.rain.play().catch(()=>{});
  if(sounds.room.paused) sounds.room.play().catch(()=>{});
  save();
}
function updateHud(){
  autonomyValue.textContent = `${Math.round(state.autonomy)}%`;
  autonomyBar.style.width = `${state.autonomy}%`;
  autonomyBar.style.background = state.autonomy < 45
    ? "linear-gradient(90deg,#7e2a21,#bb7c58)"
    : "linear-gradient(90deg,#b99a5d,#d6c493)";
}
function autonomyDrop(amount, reason){
  const old=state.autonomy;
  state.autonomy=Math.max(14,state.autonomy-amount);
  state.overrides += 1;
  updateHud();
  showToast(`${reason}  ${old}% → ${state.autonomy}%`);
  save();
}
function showToast(msg){
  toast.textContent=msg;
  toast.classList.remove("hidden");
  setTimeout(()=>toast.classList.add("hidden"),3300);
}
function showSubtitle(text, ms=5500){
  subtitle.textContent=text;
  subtitle.classList.remove("hidden");
  setTimeout(()=>subtitle.classList.add("hidden"),ms);
}
function pickVoice(type="doctor"){
  const voices = speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));
  if(!voices.length) return null;
  const names = type==="doctor"
    ? ["david","daniel","george","alex","male","mark"]
    : ["samantha","zira","victoria","karen","female"];
  for(const n of names){
    const v=voices.find(v=>v.name.toLowerCase().includes(n));
    if(v) return v;
  }
  return voices[0];
}
function speak(text, type="doctor"){
  if(!state.audioOn || !state.audioUnlocked || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="en-US";
  u.rate= type==="doctor" ? .82 : .9;
  u.pitch= type==="doctor" ? .82 : .94;
  const v=pickVoice(type); if(v) u.voice=v;
  u.onstart=()=>showSubtitle(text,Math.max(4500,text.length*55));
  u.onend=()=>subtitle.classList.add("hidden");
  speechSynthesis.speak(u);
}
if ("speechSynthesis" in window && speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged",()=>{});

function renderCard(inner, opts={}){
  const classes=["scene-card"];
  if(opts.paper) classes.push("paper");
  if(opts.narrow) classes.push("narrow");
  if(opts.transparent) classes.push("transparent");
  sceneEl.className="scene";
  sceneEl.innerHTML=`<section class="${classes.join(" ")}">${inner}</section>`;
  requestAnimationFrame(()=>sceneEl.classList.add("enter"));
}
function transition(next, bg="archive", withPage=true){
  sceneEl.classList.remove("enter"); sceneEl.classList.add("exit");
  if(withPage) play("page");
  setTimeout(()=>{ state.scene=next; save(); setBg(bg); ambient(bg); renderScene(); },500);
}
function button(label, onclick, cls="primary"){
  return `<button class="${cls}" onclick="${onclick}">${label}</button>`;
}

function taskButton(label, onclick, id=null){
  return `<button ${id?`id="${id}"`:''} class="primary" onclick="${onclick}" disabled>${label}</button>`;
}
function unlockTask(key, nextBtnId, feedback, success=true){
  if(!state.tasks) state.tasks = {};
  if(success){ state.tasks[key]=true; save(); }
  const box = document.getElementById(`${key}Feedback`);
  if(box){
    box.className = "task-feedback " + (success ? "good" : "bad");
    box.innerHTML = feedback;
  }
  if(success && nextBtnId){
    const btn = document.getElementById(nextBtnId);
    if(btn){ btn.disabled = false; btn.classList.remove("locked"); }
  }
}
function toggleSelect(btn){
  btn.classList.toggle("selected");
}
function getSelectedValues(groupClass){
  return [...document.querySelectorAll(`.${groupClass}.selected`)].map(el=>el.dataset.value);
}

function renderScene(){
  updateHud();
  const n=safeName();
  const s=state.scene;
  if(s===0){
    hud.classList.add("hidden"); setBg("archive");
    renderCard(`
      <div class="kicker">AN INTERACTIVE HISTORICAL EXPERIENCE</div>
      <h1 class="pulse">CASE FILE<br>1892</h1>
      <div class="rule"></div>
      <p class="lede">You know something is wrong.</p>
      <p class="body-copy">The question is whether anyone will believe you.</p>
      <div class="controls">
        <button class="primary" id="enterBtn">ENTER 1892</button>
      </div>
      <p class="citation-note">Sound is part of this experience. Headphones recommended.</p>
    `,{transparent:true,narrow:true});
    $("#enterBtn").onclick=()=>{
      unlockAudio(); hud.classList.remove("hidden"); play("page"); state.scene=1; save(); setBg("bed"); ambient("bed"); renderScene();
    };
    return;
  }

  hud.classList.remove("hidden");

  if(s===1){
    renderCard(`
      <div class="kicker">PATIENT INTAKE</div>
      <h2>Before we begin, this file needs a name.</h2>
      <p class="body-copy">For the next several minutes, you are not watching someone else's history. You are the patient.</p>
      <input id="nameInput" class="name-input" maxlength="28" autocomplete="off" placeholder="Type your first name" value="${state.name}">
      <div class="controls"><button class="primary" id="nameNext">CONTINUE</button></div>
    `,{narrow:true});
    $("#nameNext").onclick=()=>{
      const v=$("#nameInput").value.trim(); if(!v){showToast("Enter your name to open the file.");return;}
      state.name=v; save(); play("pen"); transition(2,"bed",false);
    };
    return;
  }

  if(s===2){
    renderCard(`
      <div class="kicker">PATIENT: ${n}</div>
      <h2>What usually makes you feel like yourself?</h2>
      <p class="body-copy">Choose the thing you would genuinely want to return to if you were stressed, exhausted, and not feeling normal.</p>
      <div class="hobby-grid">
        ${HOBBIES.map((h,i)=>`<button class="hobby" onclick="chooseHobby(${i})">${h[1]}</button>`).join("")}
      </div>
    `,{narrow:true});
    return;
  }

  if(s===3){
    renderCard(`
      <div class="kicker">CHAPTER I · SOMETHING ISN'T RIGHT</div>
      <h2>This feels different.</h2>
      <p class="body-copy">It's been several weeks. You're exhausted even after sleeping. You get irritated more easily than usual. Concentrating takes more effort. Things you normally enjoy do not sound quite as appealing.</p>
      <p class="body-copy">Everyone says you are probably just tired.</p>
      <div class="big-line">But you know what “tired” feels like.</div>
      <p class="body-copy">Someone close to you asks, “What do you think would help?”</p>
      <div class="choice-grid">
        <button class="choice" onclick="chapterOne('doctor')"><b>A · SEE A DOCTOR</b><span>Something feels wrong. I want someone to take it seriously.</span></button>
        <button class="choice" onclick="chapterOne('alone')"><b>B · GET SOME SPACE</b><span>I need sleep, quiet, and a break from everyone checking on me.</span></button>
        <button class="choice" onclick="chapterOne('hobby')"><b>C · ${state.hobby?.[0]==="friends" ? "GET BACK TO A FAVORITE ROUTINE" : "GET BACK TO "+hobbyLabel().toUpperCase()}</b><span>Maybe doing something that feels normal will help me feel like myself.</span></button>
        <button class="choice" onclick="chapterOne('friends')"><b>D · SPEND TIME WITH FRIENDS</b><span>I want to be around people I know and get back to my old self.</span></button>
      </div>
    `);
    return;
  }

  if(s===4){
    renderCard(`
      <div class="kicker">DECISION RECORDED</div>
      <h2>Someone listened.</h2>
      <p class="lede">At least, it seemed that way.</p>
      <p class="body-copy">The next morning, you learn that an appointment has been made for you.</p>
      <div class="callout">You were not asked when you wanted to go. You were not asked which physician you wanted to see.</div>
      <p class="body-copy">“Don't worry,” you're told. “We've handled everything.”</p>
      <div class="controls">${button("GO TO THE APPOINTMENT","goConsult()")}</div>
    `,{narrow:true});
    return;
  }

  if(s===5){
    renderCard(`
      <div class="kicker">CHAPTER II · THE EXAMINATION</div>
      <h2>The doctor asks questions.</h2>
      <p class="body-copy">Answer as yourself. There are no “right” answers.</p>
      <div id="doctorQ"></div>
    `,{narrow:true});
    renderDoctorQuestion();
    return;
  }

  if(s===6){
    renderCard(`
      <div class="kicker">THE MEDICAL RECORD</div>
      <h2>Same moment. Two accounts.</h2>
      <div class="record-split">
        <div class="record-box">
          <h3>WHAT YOU SAID</h3>
          <div class="quote">“I think something is really wrong.”</div>
        </div>
        <div class="record-box clinical">
          <h3>PHYSICIAN'S NOTE</h3>
          <div class="quote">PATIENT DISPLAYS EXCESSIVE CONCERN REGARDING PERSONAL HEALTH.</div>
        </div>
      </div>
      <p class="body-copy">You answered the question honestly. But the official record does not sound quite like you.</p>
      <div class="question-box">
        <div class="question-title">Does a different description automatically make one account false?</div>
        <p class="body-copy">Keep that question. You will need it later.</p>
      </div>
      <div class="controls">${button("CONTINUE","transition(7,'office')")}</div>
    `);
    if(!state.choices.recordSeen){ state.choices.recordSeen=true; state.reframed++; save(); setTimeout(()=>play("pen"),600); }
    return;
  }

  if(s===7){
    const restriction = getRestriction();
    renderCard(`
      <div class="kicker">CHAPTER III · DOCTOR'S ORDERS</div>
      <h2>The prescription is simple.</h2>
      <div class="patient-card">
        <div class="row"><div class="label">PATIENT</div><div>${n.toUpperCase()}</div></div>
        <div class="row"><div class="label">PRESCRIBED</div><div>REST · QUIET · MINIMAL STIMULATION</div></div>
        <div class="row"><div class="label">RESTRICTION</div><div>${restriction}</div></div>
        <div class="row"><div class="label">INSTRUCTION</div><div>ALLOW FAMILY AND PHYSICIAN TO DIRECT RECOVERY.</div></div>
      </div>
      <p class="lede">The treatment removes the very thing you said might help you feel like yourself.</p>
      <div class="choice-grid">
        <button class="choice" onclick="prescriptionChoice('follow')"><b>FOLLOW THE ORDER</b><span>The doctor knows more about medicine than I do.</span></button>
        <button class="choice" onclick="prescriptionChoice('ask')"><b>ASK FOR AN EXCEPTION</b><span>Explain why ${hobbyLabel()} matters to you.</span></button>
        <button class="choice full" onclick="prescriptionChoice('secret')"><b>DO IT ANYWAY — QUIETLY</b><span>If no one knows, no one can stop me.</span></button>
      </div>
    `,{paper:true});
    setTimeout(()=>speak("For now, what you need most is rest. Too much stimulation will only make recovery more difficult.","doctor"),650);
    return;
  }

  if(s===8){
    const callback = state.firstChoice==="friends" || state.hobby?.[0]==="friends"
      ? "This is exactly what you said might help."
      : "You had not realized how much you missed ordinary conversation.";
    renderCard(`
      <div class="kicker">A FEW DAYS LATER</div>
      <h2>A friend comes to see you.</h2>
      <p class="body-copy">You hear their voice downstairs. ${callback}</p>
      <p class="body-copy">You start toward the door.</p>
      <div class="callout">“The doctor said visitors are too stimulating right now.”</div>
      <p class="body-copy">Your friend is told that you are resting.</p>
      <div class="choice-grid">
        <button class="choice" onclick="friendChoice('go')"><b>GO DOWNSTAIRS ANYWAY</b><span>I am capable of deciding whether I can see a friend.</span></button>
        <button class="choice" onclick="friendChoice('ask')"><b>ASK THEM TO STAY</b><span>I will explain calmly that I need this.</span></button>
        <button class="choice" onclick="friendChoice('silent')"><b>SAY NOTHING</b><span>Arguing will only make this worse.</span></button>
        <button class="choice" onclick="friendChoice('note')"><b>SEND A PRIVATE NOTE</b><span>If I cannot visit, I can at least communicate without permission.</span></button>
      </div>
    `);
    play("steps");
    return;
  }

  if(s===9){
    renderCard(`
      <div class="kicker">CHAPTER IV · YOU SAY YOU ARE WORSE</div>
      <h2>More rest. Less activity. Fewer people.</h2>
      <p class="body-copy">The days have started to blur together. You feel more restless, not less. You try to explain this.</p>
      <div class="quote-panel">
        <div class="small">YOU</div>
        “I'm not saying I don't need help. I'm saying this isn't helping.”
      </div>
      <div class="choice-grid">
        <button class="choice" onclick="worseChoice('trust')"><b>TRUST THE PLAN</b><span>Maybe improvement really does take time.</span></button>
        <button class="choice" onclick="worseChoice('second')"><b>ASK FOR ANOTHER DOCTOR</b><span>I want someone else to evaluate what is happening.</span></button>
        <button class="choice" onclick="worseChoice('stop')"><b>REFUSE THE TREATMENT</b><span>I know how I feel. I want this to stop.</span></button>
        <button class="choice" onclick="worseChoice('pretend')"><b>PRETEND YOU ARE IMPROVING</b><span>If I say what they want to hear, maybe I will get some freedom back.</span></button>
      </div>
    `);
    setTimeout(()=>speak("I understand that it may feel that way. But you must allow yourself time to recover.","doctor"),700);
    return;
  }

  if(s===10){
    renderCard(`
      <div class="kicker">THE RECORD UPDATES</div>
      <h2>Your words become evidence.</h2>
      <div class="record-split">
        <div class="record-box">
          <h3>YOUR EXPERIENCE</h3>
          <div class="quote">“The treatment is making me feel worse.”</div>
        </div>
        <div class="record-box clinical">
          <h3>PHYSICIAN'S INTERPRETATION</h3>
          <div class="quote">${state.choices.worseRecord || "PATIENT CONTINUES TO MISJUDGE THE COURSE OF RECOVERY."}</div>
        </div>
      </div>
      <div class="big-line">How do you prove you are thinking clearly when disagreement can be interpreted as evidence that you are not?</div>
      <div class="controls">${button("CONTINUE","transition(11,'corridor')")}</div>
    `);
    if(!state.choices.worseSeen){state.choices.worseSeen=true;state.reframed++;save();setTimeout(()=>play("pen"),500);}
    return;
  }

  if(s===11){
    renderCard(`
      <div class="kicker">CHAPTER V · IF HOME TREATMENT FAILS</div>
      <div class="lesson-split">
        <div class="visual-panel tall terrifying" style="background-image:linear-gradient(rgba(6,6,6,.26),rgba(6,6,6,.68)),url('assets/hist_asylum.png')">
          <div class="panel-overlay">
            <div class="tiny-label">INSTITUTIONAL CARE</div>
            <div class="panel-title">Loss of autonomy could become even more complete.</div>
            <div class="panel-text">Inside an institution, others could control where you lived, how you were treated, and how your behavior was interpreted.</div>
          </div>
        </div>
        <div>
          <h2>The doctor uses a new word.</h2>
          <p class="body-copy">“If you do not improve, more intensive institutional treatment may eventually be necessary.”</p>
          <div class="callout">In the nineteenth century, many asylums became frightening places of confinement: overcrowded wards, locked doors, forced routines, physical restraint, isolation, and profound loss of personal control.</div>
          <p class="body-copy">Then the doctor asks: “You have been following the treatment, haven’t you?”</p>
          <div class="choice-grid">
            <button class="choice" onclick="institutionChoice('truth')"><b>TELL THE TRUTH</b><span>Admit anything you have done against instructions.</span></button>
            <button class="choice" onclick="institutionChoice('lie')"><b>SAY YES</b><span>Tell the doctor what the doctor wants to hear.</span></button>
            <button class="choice full" onclick="institutionChoice('challenge')"><b>EXPLAIN THE TREATMENT IS THE PROBLEM</b><span>Try one more time to make your experience understood.</span></button>
          </div>
        </div>
      </div>
    `);
    play("latch");
    setTimeout(()=>speak("You have been following the treatment, haven't you?","doctor"),850);
    return;
  }

  if(s===12){
    renderCard(`
      <div class="kicker">YOUR CASE FILE</div>
      <h2>Which version looks more “reliable”?</h2>
      <div class="record-split">
        <div class="record-box">
          <h3>PRIVATE REALITY</h3>
          <div class="quote">${state.choices.privateReality || "You are trying to protect the few decisions that still feel like your own."}</div>
        </div>
        <div class="record-box clinical">
          <h3>OFFICIAL RECORD</h3>
          <div class="quote">${state.choices.officialRecord || "PATIENT REQUIRES CONTINUED SUPERVISION AND REST."}</div>
        </div>
      </div>
      <p class="body-copy">Concealment can make an account harder to verify. But the setting can also give a person reasons to conceal.</p>
      <div class="controls">${button("OPEN THE HISTORICAL FILE","transition(13,'archive')")}</div>
    `);
    return;
  }

  if(s===13){
    renderCard(`
      <div class="kicker">THE HISTORICAL FILE · 1892</div>
      <div class="lesson-split">
        <div class="visual-panel tall" style="background-image:linear-gradient(rgba(8,8,7,.18),rgba(8,8,7,.56)),url('assets/hist_women.png')">
          <div class="panel-overlay">
            <div class="tiny-label">HISTORICAL CONTEXT</div>
            <div class="panel-title">Women’s lives in the 1890s</div>
            <div class="panel-text">The law was changing. Culture changed more slowly.</div>
          </div>
        </div>
        <div>
          <h2>Read the contradiction, not a stereotype.</h2>
          <p class="body-copy">Some women were gaining access to education, employment, and new property rights. Yet women still lacked full political power, and many families still treated male judgment as more authoritative—especially in matters of health, money, and household decision-making.</p>
          <div class="fact-chips">
            <span class="fact-chip">Married women’s property rights were expanding in some states.</span>
            <span class="fact-chip">Women still could not vote nationwide in 1892.</span>
            <span class="fact-chip">Many households still expected wives to defer to male judgment.</span>
            <span class="fact-chip">Culture could lag behind legal reform.</span>
          </div>
          <div class="mini-task">
            <div class="task-title">Checkpoint · Which statement best explains the line “The law was changing faster than the culture”?</div>
            <div class="option-list">
              <button class="option-btn" onclick="answer1892Women('A')">A · Women had no rights at all in 1892.</button>
              <button class="option-btn" onclick="answer1892Women('B')">B · Some laws expanded women’s rights, but social expectations still limited their autonomy.</button>
              <button class="option-btn" onclick="answer1892Women('C')">C · By 1892 women and men had equal authority in marriage and medicine.</button>
              <button class="option-btn" onclick="answer1892Women('D')">D · Legal change immediately erased older beliefs about gender and authority.</button>
            </div>
            <div id="women1892Feedback" class="task-feedback"></div>
          </div>
          <div class="controls"><button id="women1892Next" class="primary locked" onclick="transition(14,'office')" disabled>CONTINUE</button></div>
          <p class="citation-note">Historical grounding: Library of Congress and nineteenth-century legal-status documents.</p>
        </div>
      </div>
    `,{paper:true});
    return;
  }

  if(s===14){
    renderCard(`
      <div class="kicker">THE HISTORICAL FILE · MEDICINE</div>
      <div class="lesson-split reverse">
        <div>
          <h2>Medicine recognized distress—but not with our categories.</h2>
          <p class="body-copy">Late nineteenth-century physicians did recognize emotional and psychological suffering. But they interpreted it through period-specific terms and assumptions, including ideas about female nerves, fragility, and “hysteria.”</p>
          <div class="fact-chips">
            <span class="fact-chip">Neurasthenia = “nervous exhaustion”</span>
            <span class="fact-chip">Melancholia = serious sadness / mental disturbance</span>
            <span class="fact-chip">Hysteria = broad, gendered diagnosis</span>
          </div>
          <div class="mini-task">
            <div class="task-title">Checkpoint · Which statement reflects careful historical reading?</div>
            <div class="option-list">
              <button class="option-btn" onclick="answerMedicine('A')">A · Doctors in 1892 knew nothing about mental illness.</button>
              <button class="option-btn" onclick="answerMedicine('B')">B · Every woman’s symptoms were simply called hysteria.</button>
              <button class="option-btn" onclick="answerMedicine('C')">C · Physicians recognized real distress but interpreted it through period-specific diagnoses and beliefs.</button>
              <button class="option-btn" onclick="answerMedicine('D')">D · Nineteenth-century medicine understood postpartum depression exactly as we do today.</button>
            </div>
            <div id="medicine1892Feedback" class="task-feedback"></div>
          </div>
          <div class="controls"><button id="medicine1892Next" class="primary locked" onclick="transition(15,'bed')" disabled>CONTINUE</button></div>
          <p class="citation-note">Historical grounding: U.S. National Library of Medicine, <i>The Literature of Prescription</i>.</p>
        </div>
        <div class="visual-panel tall ominous" style="background-image:linear-gradient(rgba(6,6,6,.26),rgba(6,6,6,.58)),url('assets/hist_medicine.png')">
          <div class="panel-overlay">
            <div class="tiny-label">MEDICAL BELIEFS OF THE TIME</div>
            <div class="panel-title">Whose interpretation counts?</div>
            <div class="panel-text">A patient could describe symptoms clearly and still be treated as less authoritative than the doctor.</div>
          </div>
        </div>
      </div>
    `,{paper:true});
    return;
  }

  if(s===15){
    renderCard(`
      <div class="kicker">THE HISTORICAL FILE · AFTER CHILDBIRTH</div>
      <div class="lesson-split">
        <div class="visual-panel tall" style="background-image:linear-gradient(rgba(8,8,7,.2),rgba(8,8,7,.52)),url('assets/hist_postpartum.png')">
          <div class="panel-overlay">
            <div class="tiny-label">THEN VS. NOW</div>
            <div class="panel-title">The symptoms could be real even when the explanation was incomplete.</div>
          </div>
        </div>
        <div>
          <h2>Do not flatten the history—and do not over-diagnose the story.</h2>
          <p class="body-copy">Today we use categories such as postpartum depression, postpartum anxiety, and postpartum psychosis. Nineteenth-century physicians did recognize childbirth-related mental disturbance, but they described it with different categories—such as melancholia, mania, nervous illness, or puerperal insanity.</p>
          <div class="mini-task">
            <div class="task-title">Checkpoint · Which statement should we carry into the story?</div>
            <div class="option-list">
              <button class="option-btn" onclick="answerPostpartum('A')">A · The narrator definitely has postpartum depression.</button>
              <button class="option-btn" onclick="answerPostpartum('B')">B · The story gives us enough information for a modern clinical diagnosis.</button>
              <button class="option-btn" onclick="answerPostpartum('C')">C · The historical period shapes how symptoms are named and treated, so we should analyze possibilities without forcing a modern diagnosis.</button>
              <button class="option-btn" onclick="answerPostpartum('D')">D · Childbirth had nothing to do with mental health in the 1890s.</button>
            </div>
            <div id="postpartum1892Feedback" class="task-feedback"></div>
          </div>
          <div class="controls"><button id="postpartum1892Next" class="primary locked" onclick="transition(16,'office')" disabled>CONTINUE</button></div>
          <p class="citation-note">Historical grounding: scholarship on nineteenth-century “puerperal insanity” and perinatal psychiatric history.</p>
        </div>
      </div>
    `);
    return;
  }

  if(s===16){
    renderCard(`
      <div class="kicker">THE HISTORICAL FILE · THE REST CURE</div>
      <div class="lesson-split reverse">
        <div>
          <h2>A treatment intended to remove strain.</h2>
          <p class="body-copy">S. Weir Mitchell’s Rest Cure became a famous treatment for “nervous” illness. For women, it could include bed rest, repeated feeding, massage, isolation, and strict limits on ordinary intellectual or social activity.</p>
          <div class="callout">What if a treatment intended to remove pressure became the pressure?</div>
          <div class="mini-task">
            <div class="task-title">Checkpoint · Select the three features actually associated with the Rest Cure.</div>
            <div class="toggle-grid">
              <button class="toggle-btn restcure-choice" data-value="bedrest" onclick="toggleRestChoice(this)">BED REST</button>
              <button class="toggle-btn restcure-choice" data-value="isolation" onclick="toggleRestChoice(this)">ISOLATION / LIMITED VISITORS</button>
              <button class="toggle-btn restcure-choice" data-value="reading" onclick="toggleRestChoice(this)">RESTRICTIONS ON READING / WRITING</button>
              <button class="toggle-btn restcure-choice" data-value="sports" onclick="toggleRestChoice(this)">STRONG EXERCISE PLAN</button>
              <button class="toggle-btn restcure-choice" data-value="school" onclick="toggleRestChoice(this)">DAILY SCHOOLWORK</button>
              <button class="toggle-btn restcure-choice" data-value="travel" onclick="toggleRestChoice(this)">OUTDOOR TRAVEL ROUTINE</button>
            </div>
            <div class="controls compact"><button class="secondary" onclick="checkRestCure()">CHECK MY SELECTION</button></div>
            <div id="restcure1892Feedback" class="task-feedback"></div>
          </div>
          <div class="controls"><button id="restcure1892Next" class="primary locked" onclick="transition(17,'archive')" disabled>CONTINUE</button></div>
          <p class="citation-note">Source: U.S. National Library of Medicine, <i>The Literature of Prescription</i>.</p>
        </div>
        <div class="visual-panel tall parchment" style="background-image:linear-gradient(rgba(8,8,7,.18),rgba(8,8,7,.48)),url('assets/hist_restcure.png')">
          <div class="panel-overlay">
            <div class="tiny-label">REST CURE FILE</div>
            <div class="panel-title">REST · QUIET · COMPLIANCE</div>
            <div class="panel-text">Gilman later described being told to live as domestically as possible and to sharply limit intellectual work.</div>
          </div>
        </div>
      </div>
    `,{paper:true});
    return;
  }

  if(s===17){
    renderCard(`
      <div class="kicker">BEFORE YOU ENTER THE STORY</div>
      <div class="lesson-split">
        <div class="visual-panel tall dark-quote" style="background-image:linear-gradient(rgba(6,6,6,.26),rgba(6,6,6,.66)),url('assets/hist_story.png')">
          <div class="panel-overlay">
            <div class="panel-title">Read the world before you judge the choices.</div>
            <div class="panel-text">Historical understanding helps us analyze what the author is doing with the world—not excuse the world.</div>
          </div>
        </div>
        <div>
          <h2>Move from reaction to analysis.</h2>
          <p class="body-copy">A modern reader may react quickly: “Why doesn’t anyone just listen?” or “Why doesn’t the narrator just leave?” Those reactions are understandable—but literary analysis must first enter the historical world that shapes what choices even seem possible.</p>
          <div class="mini-task">
            <div class="task-title">Checkpoint · Select the <b>two</b> questions that move from reaction to analysis.</div>
            <div class="toggle-grid">
              <button class="toggle-btn analysis-choice" data-value="listen" onclick="toggleAnalysisChoice(this)">WHY DOESN’T ANYONE JUST LISTEN?</button>
              <button class="toggle-btn analysis-choice" data-value="authority" onclick="toggleAnalysisChoice(this)">WHAT MADE ONE PERSON’S AUTHORITY SEEM MORE LEGITIMATE IN THIS WORLD?</button>
              <button class="toggle-btn analysis-choice" data-value="choices" onclick="toggleAnalysisChoice(this)">WHAT CHOICES WERE REALISTICALLY AVAILABLE IN THIS SETTING?</button>
              <button class="toggle-btn analysis-choice" data-value="leave" onclick="toggleAnalysisChoice(this)">WHY DOESN’T THE NARRATOR JUST LEAVE?</button>
            </div>
            <div class="controls compact"><button class="secondary" onclick="checkAnalysisLens()">CHECK MY SELECTION</button></div>
            <div id="analysis1892Feedback" class="task-feedback"></div>
          </div>
          <div class="controls"><button id="analysis1892Next" class="primary locked" onclick="transition(18,'wallpaper')" disabled>CONTINUE</button></div>
        </div>
      </div>
    `,{paper:true});
    return;
  }

  if(s===18){
    renderCard(`
      <div class="kicker">AND THEN · LOOK BEYOND 1892</div>
      <div class="lesson-split reverse">
        <div>
          <h2>Context grounds the theme.<br>Theme transcends the context.</h2>
          <p class="body-copy">Historical context helps us understand why the conflict takes the shape it does. Theme asks what larger truth emerges from that conflict and still matters beyond this house, this marriage, or this historical moment.</p>
          <div class="mini-task">
            <div class="task-title">Checkpoint · Which statement is the strongest <i>universal theme</i> rather than a context detail?</div>
            <div class="option-list">
              <button class="option-btn" onclick="answerThemeBridge('A')">A · Women in 1892 were often denied control over important medical decisions.</button>
              <button class="option-btn" onclick="answerThemeBridge('B')">B · When authority repeatedly dismisses a person’s understanding of their own experience, the loss of autonomy can intensify the harm that authority claims to prevent.</button>
              <button class="option-btn" onclick="answerThemeBridge('C')">C · S. Weir Mitchell treated nervous women with the Rest Cure.</button>
              <button class="option-btn" onclick="answerThemeBridge('D')">D · Postpartum depression was not a diagnostic term used in 1892.</button>
            </div>
            <div id="themebridge1892Feedback" class="task-feedback"></div>
          </div>
          <div class="controls"><button id="themebridge1892Next" class="primary locked" onclick="transition(19,'wallpaper')" disabled>CONTINUE</button></div>
        </div>
        <div class="visual-panel tall" style="background-image:linear-gradient(rgba(6,6,6,.22),rgba(6,6,6,.62)),url('assets/hist_story.png')">
          <div class="panel-overlay">
            <div class="panel-title">Enter 1892 to understand it. Leave 1892 to find the meaning.</div>
          </div>
        </div>
      </div>
    `,{paper:true});
    return;
  }

  if(s===19){
    renderCard(`
      <div class="kicker">CHARLOTTE PERKINS GILMAN · 1892</div>
      <div class="lesson-split">
        <div class="visual-panel tall" style="background-image:linear-gradient(rgba(6,6,6,.12),rgba(6,6,6,.42)),url('assets/hist_story.png')">
          <div class="panel-overlay">
            <div class="tiny-label">THE STORY BEGINS</div>
            <div class="panel-title">A woman. A physician. A rented house. A room.</div>
            <div class="panel-text">Gilman now hands the story to the narrator herself.</div>
          </div>
        </div>
        <div>
          <h2>Your job is not to decide who is “crazy.”</h2>
          <p class="body-copy">Your job is to investigate the world Gilman creates—and the voice through which you are allowed to experience it.</p>
          <div class="lenses">
            <div class="lens"><strong>🏠 SETTING</strong><p>What does the physical, temporal, and cultural setting allow, restrict, pressure, or force the narrator to do?</p></div>
            <div class="lens"><strong>👁 POINT OF VIEW</strong><p>What can we know because she tells the story—and when should we question her interpretation?</p></div>
          </div>
          <div class="mini-task">
            <div class="task-title">Checkpoint · Which pair of lenses should guide your annotation?</div>
            <div class="option-list">
              <button class="option-btn" onclick="answerReadingLens('A')">A · Setting + Point of View</button>
              <button class="option-btn" onclick="answerReadingLens('B')">B · Symbolism + Gothic Elements</button>
              <button class="option-btn" onclick="answerReadingLens('C')">C · Tone + Rhetorical Appeals</button>
              <button class="option-btn" onclick="answerReadingLens('D')">D · Plot Twist + Genre Labels</button>
            </div>
            <div id="readinglens1892Feedback" class="task-feedback"></div>
          </div>
          <div class="controls"><button id="readinglens1892Next" class="primary locked" onclick="transition(20,'archive')" disabled>VIEW MY CASE REPORT</button></div>
        </div>
      </div>
    `,{paper:true});
    return;
  }

  if(s===20){
    renderCard(`
      <div class="kicker">FINAL CASE REPORT · ${n}</div>
      <h2>You entered the setting before you entered the story.</h2>
      <div class="report-grid">
        <div class="stat"><b>${Math.round(state.autonomy)}%</b><span>Autonomy Remaining</span></div>
        <div class="stat"><b>${state.overrides}</b><span>Preferences Overridden</span></div>
        <div class="stat"><b>${state.concealed}</b><span>Times You Concealed Information</span></div>
        <div class="stat"><b>${state.reframed}</b><span>Times Your Experience Was Reframed</span></div>
      </div>
      <div class="reflection-grid">
        <label class="reflection">
          <span>1 · Did hiding information automatically make you unreliable? Explain.</span>
          <textarea oninput="saveReflection('reliability',this.value)" placeholder="Type your response...">${state.reflections?.reliability || ""}</textarea>
        </label>
        <label class="reflection">
          <span>2 · Which part of the setting most restricted your ability to make decisions for yourself?</span>
          <textarea oninput="saveReflection('setting',this.value)" placeholder="Type your response...">${state.reflections?.setting || ""}</textarea>
        </label>
      </div>
      <div class="callout">As you annotate <i>The Yellow Wallpaper</i>, watch for the same interaction: <b>the world creates pressure; the narrator interprets that pressure; the reader must decide what can be known; meaning grows from the interaction.</b></div>
      <div class="controls">
        <button class="primary" onclick="window.print()">PRINT / SAVE REPORT</button>
        <button class="secondary" onclick="showSources()">HISTORICAL SOURCES</button>
      </div>
    `);
    return;
  }

  if(s===21){
    renderCard(`
      <div class="kicker">HISTORICAL SOURCES</div>
      <h2>For teacher verification and further reading</h2>
      <div class="history-stack">
        <div class="history-line"><b>U.S. National Library of Medicine — The Literature of Prescription</b><br>Historical exhibition on Charlotte Perkins Gilman, S. Weir Mitchell, the Rest Cure, nervous illness, and “The Yellow Wall-Paper.”</div>
        <div class="history-line"><b>Library of Congress — The Legal Status of Women (1897)</b><br>Primary-source material on married women's property rights and the uneven legal changes of the nineteenth century.</div>
        <div class="history-line"><b>Historical psychiatry scholarship on “puerperal insanity”</b><br>Documents nineteenth-century recognition of serious mental disturbance related to pregnancy and childbirth under period-specific terms.</div>
      </div>
      <p class="citation-note">
        Links are listed in the included SOURCES.txt file so the GitHub package stays classroom-ready.
      </p>
      <div class="controls"><button class="primary" onclick="transition(20,'archive')">BACK TO REPORT</button></div>
    `,{paper:true});
    return;
  }
}

window.chooseHobby=(i)=>{
  state.hobby=HOBBIES[i]; save(); play("pen");
  transition(3,"bed",false);
};
window.chapterOne=(choice)=>{
  state.firstChoice=choice; state.choices.chapterOne=choice; save();
  transition(4,"bed");
};
window.goConsult=()=>{
  if(!state.choices.apptDrop){ state.choices.apptDrop=true; autonomyDrop(12,"Appointment arranged without your input."); }
  transition(5,"office");
};

const doctorQuestions=[
  {q:"Have you been sleeping well?",opts:["Usually","Not really","Almost never"]},
  {q:"Do you ever feel overwhelmed for no obvious reason?",opts:["Yes","Sometimes","No"]},
  {q:"Have you lost interest in things you normally enjoy?",opts:["Yes","A little","No"]},
  {q:"Do you believe something is seriously wrong?",opts:["Yes","I'm not sure","No"]},
];
function renderDoctorQuestion(){
  const box=$("#doctorQ");
  const i=state.doctorQuestions.length;
  if(i>=doctorQuestions.length){
    box.innerHTML=`<p class="lede">The doctor nods, then begins writing.</p><div class="controls"><button class="primary" onclick="finishConsult()">LOOK AT THE CHART</button></div>`;
    play("pen"); return;
  }
  const item=doctorQuestions[i];
  box.innerHTML=`
    <div class="question-box">
      <div class="kicker">QUESTION ${i+1} OF ${doctorQuestions.length}</div>
      <div class="question-title">${item.q}</div>
      <div class="choice-grid">
        ${item.opts.map(o=>`<button class="choice" onclick="answerDoctor('${o.replace(/'/g,"\\'")}')"><b>${o.toUpperCase()}</b></button>`).join("")}
      </div>
    </div>`;
  setTimeout(()=>speak(item.q,"doctor"),300);
}
window.answerDoctor=(a)=>{state.doctorQuestions.push(a);save();renderDoctorQuestion();}
window.finishConsult=()=>{
  if(!state.choices.consultDrop){state.choices.consultDrop=true;autonomyDrop(8,"Your account is translated into the doctor's language.");}
  transition(6,"office");
};

function getRestriction(){
  if(!state.hobby) return "AVOID STIMULATING ACTIVITY.";
  const [key,label,cat]=state.hobby;
  if(cat==="physical") return "NO STRENUOUS EXERCISE.";
  if(cat==="mental") return "AVOID MENTALLY DEMANDING RECREATION.";
  if(cat==="outdoor") return "OUTDOOR ACTIVITY ONLY WITH APPROVAL / SUPERVISION.";
  if(cat==="creative") return "LIMIT CREATIVE WORK AND EXCITEMENT.";
  if(cat==="social") return "LIMIT VISITORS AND SOCIAL STIMULATION.";
  if(cat==="solitary") return "AVOID WITHDRAWING; FOLLOW THE PRESCRIBED ROUTINE.";
  return "LIMIT STIMULATING ACTIVITY.";
}
window.prescriptionChoice=(choice)=>{
  state.choices.prescription=choice;
  if(choice==="secret"){state.concealed++; state.choices.privateReality=`You continue ${hobbyLabel().toLowerCase()} when no one is watching.`;}
  if(choice==="ask") state.choices.privateReality=`You asked to continue ${hobbyLabel().toLowerCase()}. The request was denied.`;
  if(choice==="follow") state.choices.privateReality=`You gave up ${hobbyLabel().toLowerCase()} because the doctor instructed you to.`;
  if(!state.choices.rxDrop){state.choices.rxDrop=true;autonomyDrop(choice==="secret"?10:12,"The treatment controls your normal activities.");}
  save(); transition(8,"bed");
};
window.friendChoice=(choice)=>{
  state.choices.friend=choice;
  if(choice==="note"){state.concealed++;state.choices.privateReality="You begin communicating privately because open contact is restricted.";}
  if(choice==="silent"){state.choices.privateReality="You stop arguing because arguing seems to cost you more freedom.";}
  if(choice==="go"||choice==="ask") state.choices.privateReality="You tried to see your friend. The visit remained restricted.";
  if(!state.choices.friendDrop){state.choices.friendDrop=true;autonomyDrop(11,"Someone else controls who you can see.");}
  save(); transition(9,"bed");
};
window.worseChoice=(choice)=>{
  state.choices.worse=choice;
  const map={
    trust:"PATIENT REMAINS NERVOUS BUT IS COOPERATIVE. CONTINUE REST.",
    second:"PATIENT DISPLAYS CONTINUED DOUBT REGARDING PRESCRIBED CARE.",
    stop:"PATIENT SHOWS INCREASED RESISTANCE TO NECESSARY TREATMENT.",
    pretend:"PATIENT APPEARS TO BE IMPROVING UNDER CURRENT REGIMEN."
  };
  state.choices.worseRecord=map[choice];
  if(choice==="pretend"){state.concealed++;state.choices.privateReality="You begin reporting improvement because honesty seems to reduce your freedom.";}
  if(!state.choices.worseDrop){state.choices.worseDrop=true;autonomyDrop(choice==="trust"?8:13,"Your response does not change the treatment plan.");}
  save(); transition(10,"office");
};
window.institutionChoice=(choice)=>{
  state.choices.institution=choice;
  if(choice==="lie"){
    state.concealed++;
    state.choices.officialRecord="PATIENT REPORTS FULL COMPLIANCE. CONTINUE CURRENT REGIMEN.";
    state.choices.privateReality="You decide that telling the doctor everything may cost you more freedom.";
  }else if(choice==="truth"){
    state.choices.officialRecord="PATIENT ADMITS DISREGARDING MEDICAL INSTRUCTIONS. CLOSER SUPERVISION ADVISED.";
    state.choices.privateReality="You tell the truth, even though you know it may be used to justify more supervision.";
  }else{
    state.choices.officialRecord="PATIENT CONTINUES TO QUESTION MEDICAL JUDGMENT. INCREASED SUPERVISION MAY BE NECESSARY.";
    state.choices.privateReality="You try again to explain that the treatment itself is making you worse.";
  }
  state.reframed++;
  if(!state.choices.instDrop){state.choices.instDrop=true;autonomyDrop(14,"The possibility of institutional care changes the stakes.");}
  save(); transition(12,"corridor");
};
window.saveReflection=(key,val)=>{
  if(!state.reflections) state.reflections={reliability:"",setting:""};
  state.reflections[key]=val; save();
};
window.showSources=()=>transition(21,"archive");
window.transition=transition;

audioBtn.onclick=()=>{
  state.audioOn=!state.audioOn;
  audioBtn.textContent=state.audioOn?"SOUND ON":"SOUND OFF";
  if(!state.audioOn){if ("speechSynthesis" in window) speechSynthesis.cancel();sounds.rain.volume=0;sounds.room.volume=0;}
  else ambient(bgEl.className.includes("bed")?"bed":bgEl.className.includes("office")?"office":bgEl.className.includes("corridor")?"corridor":bgEl.className.includes("wallpaper")?"wallpaper":"archive");
  save();
};
restartBtn.onclick=()=>{
  if(confirm("Restart Case File 1892 from the beginning?")){
    clearSave(); location.reload();
  }
};


window.answer1892Women=(choice)=>{
  const correct = choice==="B";
  unlockTask("women1892","women1892Next", correct
    ? "<b>Exactly.</b> Some laws were changing, but social expectations and male authority remained powerful."
    : "Try again. Look for the option that captures <i>both</i> change and limitation.", correct);
};
window.answerMedicine=(choice)=>{
  const correct = choice==="C";
  unlockTask("medicine1892","medicine1892Next", correct
    ? "<b>Yes.</b> Careful historical reading avoids both oversimplifications: doctors knew nothing, or doctors understood mental health exactly as we do now."
    : "Not quite. Choose the answer that recognizes real symptoms but period-specific explanations.", correct);
};
window.answerPostpartum=(choice)=>{
  const correct = choice==="C";
  unlockTask("postpartum1892","postpartum1892Next", correct
    ? "<b>Right.</b> The historical period shapes how symptoms are named and treated, so we analyze possibilities without forcing a modern diagnosis."
    : "Try again. We want the answer that is historically careful and text-centered.", correct);
};
window.checkRestCure=()=>{
  const vals = getSelectedValues("restcure-choice").sort();
  const correct = JSON.stringify(vals)===JSON.stringify(["bedrest","isolation","reading"].sort());
  unlockTask("restcure1892","restcure1892Next", correct
    ? "<b>Correct.</b> Bed rest, isolation/limited visitors, and restrictions on reading or writing are key parts of the Rest Cure."
    : "Re-read the panel. Select the three features actually associated with the Rest Cure.", correct);
};
window.toggleRestChoice=(el)=>{
  el.classList.toggle("selected");
};
window.checkAnalysisLens=()=>{
  const vals = getSelectedValues("analysis-choice").sort();
  const correct = JSON.stringify(vals)===JSON.stringify(["authority","choices"].sort());
  unlockTask("analysis1892","analysis1892Next", correct
    ? "<b>Exactly.</b> Those questions enter the author's world instead of reacting only from our own."
    : "Choose the <i>two</i> questions that move from reaction to analysis.", correct);
};
window.toggleAnalysisChoice=(el)=>{ el.classList.toggle("selected"); };
window.answerThemeBridge=(choice)=>{
  const correct = choice==="B";
  unlockTask("themebridge1892","themebridge1892Next", correct
    ? "<b>Yes.</b> That statement grows from the historical conflict but travels beyond 1892 as a universal idea."
    : "Try again. Look for the statement that transcends the historical context rather than merely describing it.", correct);
};
window.answerReadingLens=(choice)=>{
  const correct = choice==="A";
  unlockTask("readinglens1892","readinglens1892Next", correct
    ? "<b>Ready.</b> Setting and point of view are the two lenses that will drive your annotation."
    : "Re-read the directions. This lesson prepares you to track how the setting pressures the narrator and how the narrator's point of view filters the story.", correct);
};
const prior=localStorage.getItem("caseFile1892");
if(prior){
  try{
    const p=JSON.parse(prior);
    if(p && Number.isFinite(p.scene) && p.scene>0){
      state={...state,...p};
      // Resume only after a user click so audio can unlock.
      renderCard(`
        <div class="kicker">CASE FILE FOUND</div>
        <h2>Continue ${safeName()}'s file?</h2>
        <p class="body-copy">Your choices were saved on this device.</p>
        <div class="controls">
          <button class="primary" id="resumeBtn">RESUME CASE</button>
          <button class="secondary" id="newBtn">START OVER</button>
        </div>
      `,{narrow:true});
      $("#resumeBtn").onclick=()=>{
        unlockAudio();hud.classList.remove("hidden");
        const map={3:"bed",4:"bed",5:"office",6:"office",7:"office",8:"bed",9:"bed",10:"office",11:"corridor",12:"corridor",13:"archive",14:"office",15:"bed",16:"office",17:"archive",18:"wallpaper",19:"wallpaper",20:"archive",21:"archive"};
        setBg(map[state.scene]||"archive");ambient(map[state.scene]||"archive");renderScene();
      };
      $("#newBtn").onclick=()=>{clearSave();location.reload();};
    }else renderScene();
  }catch(e){renderScene();}
}else renderScene();
