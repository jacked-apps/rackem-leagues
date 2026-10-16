/**
 * @fileoverview Content of the Stop Stop explainer page (/aboutstopstop).
 *
 * Generated from docs/public/about-stop-stop.md in the stop-stop repo, which
 * is the source of truth: edit there, then copy here. `**bold**` in the text
 * is rendered bold by the page.
 */

export type ExplainerBlock = { type: 'text'; text: string } | { type: 'list'; items: string[] };

export type ExplainerSection = { title: string; blocks: ExplainerBlock[] };

export const STOP_STOP_SECTIONS: ExplainerSection[] = [
  {
    "title": "Why this exists",
    "blocks": [
      {
        "type": "text",
        "text": "The simple fact that an app like this needs to exist horrifies me. Too many victims are afraid to come forward, or can’t. When they do, they’re ridiculed, gaslit, or told they aren’t telling the truth. Or worse: that they wanted it, or deserved it."
      },
      {
        "type": "text",
        "text": "Evidence changes that conversation. Stop Stop is my very small way of trying to change the system."
      }
    ]
  },
  {
    "title": "The idea",
    "blocks": [
      {
        "type": "text",
        "text": "Stop Stop is a free phone app. You turn it on once, and it quietly listens for two words, **“stop stop”**, the same way your phone already listens for “Hey Google”, “Hi Bixby” or “Hey Siri”. When it hears them, it starts recording, and a locked copy goes to the cloud every few seconds. The evidence survives even if the phone is taken or smashed, and only the victim can open it."
      },
      {
        "type": "text",
        "text": "Stop Stop can’t stop an attack. It records evidence of one, keeps it safe, and proves when it was made."
      }
    ]
  },
  {
    "title": "How it works",
    "blocks": [
      {
        "type": "list",
        "items": [
          "**Why “stop stop”.** The words were chosen on purpose: saying them is itself a clear “no”. Anyone who says “stop” twice is plainly not giving consent, and since every recording starts 10 seconds before the words, that “no” is on the recording too. Anyone who knows this app exists should treat “stop stop” as a universal safe word that overrides any earlier agreement, spoken or not.",
          "**Always on, out of the way.** It runs in the background day and night without getting in the way of normal phone use. Nothing is recorded or sent anywhere until it hears “stop stop”; the listening happens entirely on the phone.",
          "**It catches the moment before.** Each recording starts 10 seconds before the words, and keeps going until the victim stops it with their PIN. There’s no spoken “off”, so nobody else can switch it off by voice.",
          "**Saved as it happens.** Every few seconds a locked piece goes to the cloud with a receipt proving when it arrived. Taking or breaking the phone can’t erase what was already sent.",
          "**The user is in complete control.** Recordings are locked before they leave the phone. The user’s PIN opens them on the phone; their 24-word recovery key opens them anywhere. **Even we can’t open them.** Users decide who else can: they can give a copy of the 24 words to someone they trust (family, a friend, a lawyer), or to no one at all. Only they can turn listening off, again with their PIN. Putting the user in control is our ultimate goal.",
          "**Quiet from the outside.** The last thing we want is for a user to be hurt further because someone else saw the app. So it stays as inconspicuous as we can make it: for example, Android requires a notification while the app listens, and instead of “Stop Stop is listening” ours shows a generic icon and “Sync active”. Some rules we can’t get around, such as the small microphone dot Android and iPhone show while any app uses the microphone (on iPhone only while the screen is on). We’ll keep working to make it less noticeable, but there’s only so much we can do without support from Android and Apple.",
          "**Practice built in.** A tutorial lets them practice saying “stop stop” with the phone in a hand, pocket or bag, so they know how loud they need to be if the day ever comes."
        ]
      }
    ]
  },
  {
    "title": "Where it stands",
    "blocks": [
      {
        "type": "text",
        "text": "It isn’t public yet, but it’s real and working on an Android phone today:"
      },
      {
        "type": "list",
        "items": [
          "Listening for “stop stop” in the background, with the screen off",
          "Recording with the 10 seconds before, locked and uploaded as it happens, with receipts",
          "PIN lock, the 24-word recovery key, playing recordings back, and deleting with a 7-day wait",
          "Working alongside Google and Bixby voice assistants",
          "The practice tutorial",
          "Stopping a recording, or turning listening off, only with the PIN"
        ]
      },
      {
        "type": "text",
        "text": "**iPhone:** a test app kept listening with the phone locked and came back on its own after Siri, timers and other apps used the microphone. That was the big unknown, and it’s the reason an iPhone version looks possible. Stop Stop’s screens already run on iPhone; the listening and recording parts are being built now."
      }
    ]
  },
  {
    "title": "Honest limits",
    "blocks": [
      {
        "type": "list",
        "items": [
          "**It records; it can’t call for help or stop anyone.**",
          "**It can’t hear during phone calls**, or while another app is using the microphone.",
          "**Restarting the phone stops listening** until the app is opened again; phones don’t let apps turn the microphone back on by themselves.",
          "**On iPhone, “Hey Siri” doesn’t work while Stop Stop listens** (holding the side button still does). On Android we found a way to share the microphone with Google and Bixby; we’ll try the same on iPhone.",
          "**A muffled phone hears less** (deep in a bag, under a coat). Practice shows where it works.",
          "**Battery:** about 1.5% an hour in our early test. A full-day measurement is still to come.",
          "**Losing both the phone and the 24 words means losing the recordings.** Nobody, including us, can get them back.",
          "**Storage costs money.** Keeping everyone’s evidence safe means paying for storage and servers. We at Jacked Apps don’t want to make money from this, and we’re willing to lose some on it, but we’ll have to find a way to cover those costs to keep it running.",
          "**The law hasn’t caught up.** Recording laws differ from state to state and country to country. In some places recording a conversation without everyone’s consent isn’t allowed, and a court may not accept the recording. We think that should change, and with enough pressure, laws do change. Until then, evidence still matters: it can help a victim be believed by family, friends, advocates, and the public."
        ]
      }
    ]
  },
  {
    "title": "What’s next",
    "blocks": [
      {
        "type": "list",
        "items": [
          "A second PIN that opens a harmless decoy, for when someone forces the victim to open the app",
          "**Incident mode:** long incidents keep being recorded whenever there’s sound, without saying “stop stop” again",
          "Location with each recording, if turned on",
          "A disguised app icon",
          "Restoring on a new phone with the 24 words",
          "iPhone (in progress)",
          "Alerting a trusted contact when a recording starts"
        ]
      }
    ]
  },
  {
    "title": "What I’d love to hear from you",
    "blocks": [
      {
        "type": "text",
        "text": "Your perspective is exactly the one I’m missing. Anything you think helps, for example:"
      },
      {
        "type": "list",
        "items": [
          "Would the people you speak for trust an app like this? What would stop them from using it?",
          "What’s missing, or what worries you?",
          "Should it look like what it is, a safety app, or stay disguised on the phone? Being honest builds trust and keeps it clearly apart from spy apps; disguise protects someone whose phone gets searched.",
          "Who else should I be talking to: advocates, lawyers, shelters?",
          "How do you think something like this should be paid for, so it stays free for victims?"
        ]
      }
    ]
  }
];
