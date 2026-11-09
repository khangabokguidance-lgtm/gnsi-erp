GNSI PREMIUM BOOKLET BUILDER
Guidance Navodaya and Sainik Institute
Prepared by Sir Moirangthem Himan Singh, Founder

WHAT IT DOES
Turns any chapter question file (.docx) into the navy-and-gold premium booklet:
cover page, contents, two-column questions sorted by type, answer key and
worked solutions. English in Calibri/Cambria, Manipuri in Bmei04.

FILES
  gnsi_booklet.py               the program (the design is in the DESIGN section at the top)
  factors_and_multiples.json    example settings for Chapter 4
  4-Factors_and_Multiples.docx  the example source file

ONE-TIME SETUP (Windows)
  1. Install Python from python.org (tick "Add Python to PATH").
  2. Open Command Prompt and run:   pip install python-docx
  3. Make sure the Bmei04 font is installed.

MAKE A BOOKLET
  1. Put the chapter .docx, a settings .json and gnsi_booklet.py in one folder.
  2. In that folder run:            python gnsi_booklet.py factors_and_multiples.json
     Single column instead:          python gnsi_booklet.py factors_and_multiples.json --columns 1

THE SOURCE FILE MUST LOOK LIKE YOUR CHAPTER FILES
  Q1. English question               (bold, starts with "Q" + number + ".")
  Manipuri line                      (Bmei04)
  (A) ...  (B) ...  (C) ...  (D) ...
  ...
  Q1. B   Q2. C ...                  (answer key at the end - optional)

SETTINGS FILE (.json) - copy the example and change it
  Required:  "source", "output", "title"
  Optional:
    "title_mm"          Manipuri title for the cover (typed in Bmei04 keys, e.g. "feKtr AmsuZ mLtipL")
    "label"             small line above the title, e.g. "Mathematics  ·  Chapter 5"
    "groups"            the types: [{"code":"A","name":"Prime Factorisation","questions":[1,2,15]}, ...]
                        (leave out to keep the original order; any question not listed goes in "Other Questions")
    "answers"           correct or add answers: {"14":"C"}  (overrides the file's key)
    "solutions"         one-line working: {"1":"360 = 2³ × 3² × 5"}
    "set_english"       replace a whole English question: {"11":"The factors of 20 are:"}
    "replace_english"   fix part of a question: {"15":[["657","675"]]}
    "set_options"       replace all four options: {"51":["2","3","6","7"]}
    "set_option"        replace one option: {"47":{"C":"7 x 5 x 3 x 3 x 2 x 2"}}
    "replace_manipuri"  fix the Manipuri line: {"22":[["mLtipL nTtb","mLtipL AoIb"]]}
                        add a number to pick which match: {"56":[["3","5",2]]} changes the 2nd "3"
  Question numbers in the settings are always the ORIGINAL numbers from the source file.

CHANGE THE DESIGN
  Open gnsi_booklet.py and edit the DESIGN section at the top:
    navy  1B2A4A   main colour (cover, headings, section bars)
    gold  B8892B   accent (rules, option letters, type badge)
    tint  F4EFE3   light rows in tables
    fonts Cambria (headings), Calibri (English), Bmei04 (Manipuri)
    sizes, margins, column gap, institute name, motto, author name and footer text
  Every booklet made afterwards uses the new design.

IN THE GNSI PORTAL
  The same builder is in the portal: Learning Hub → Question Bank →
  "Booklet Builder" (under Papers & tests). Open the chapter .docx, load or
  fill in the settings, and download the booklet — no Python needed. The
  Bmei04 font is embedded in the booklet made there. Settings files saved
  there work with this program too, and the other way round.
