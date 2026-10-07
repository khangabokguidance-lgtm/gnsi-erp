# Offline translator for the Mayek Tool

Translates English into Manipuri (Meetei Mayek or Bengali script), Hindi or
Bengali on your own computer, with no internet, using the open-source
IndicTrans2 model from AI4Bharat. The ERP's Mayek Tool (Question Bank →
Mayek Tool → Translate) uses it when you tick **Use the offline translator on
this computer**.

It is machine translation: check every result before it goes into a paper,
the same as with Bhashini, Google Translate or Gemini.

## One-time setup (needs internet)

1. Install Python **3.12** from python.org (3.12.10 is the last version with a
   Windows installer), ticking "Add python.exe to PATH". Avoid the newest
   Python: PyTorch often has no build for it and fails with "Failed to load
   PyTorch C extensions". `start-translator.bat` picks 3.12, 3.11, 3.13 or 3.10
   through the `py` launcher, so newer versions can stay installed.
2. Install "Microsoft C++ Build Tools" with the **Desktop development with C++**
   workload (one of the packages is compiled during install).
3. Copy this folder to the computer, open a Command Prompt in it and run:

       py -3.12 -m pip install torch --index-url https://download.pytorch.org/whl/cpu
       py -3.12 -m pip install -r requirements.txt

4. Make a free account at huggingface.co, open the page of the model
   `ai4bharat/indictrans2-en-indic-dist-200M` and accept its terms. Create a
   **Read** token under Settings → Access Tokens, then run:

       hf auth login --token YOUR_TOKEN
       hf download ai4bharat/indictrans2-en-indic-dist-200M

   The download is about 1 GB. The token is not needed again and can be deleted.

## Everyday use (no internet)

1. Double-click `start-translator.bat` and wait for "Offline translator is
   ready". Keep that window open.
2. In the ERP, open Question Bank → Mayek Tool → Translate and tick **Use the
   offline translator on this computer**. It should show "running".
3. Translate as usual. The result box is headed "Offline translator" when this
   engine did the work.

The tick is remembered per browser, so only computers that have the program
need it. If the program is not running, the ERP uses its other engines and says so.

### Starting it automatically

Double-click `install-autostart.bat` once. From then on the program starts by
itself, with no window, each time you sign in to Windows, so step 1 above is
no longer needed. It takes about a minute after sign-in to be ready, and it
keeps the model in memory (roughly 1 to 2 GB) while the computer is on.

If it does not come up, `translator.log` in this folder says why. Run
`remove-autostart.bat` to stop it and turn automatic start off.

## Good to know

- English is the only source language. Other directions (for example Manipuri
  to English) go to the ERP's other engines.
- The first time, Chrome or Edge may ask whether the site may reach apps on
  this device. Choose **Allow**.
- Only the ERP at guidancekhangabok.in, the desktop app and a local dev server
  may call the program. To allow another address, such as a Vercel preview, start it with
  `start-translator.bat --allow-origin https://your-preview.vercel.app`.
- It listens on this computer only (127.0.0.1, port 8765) and is not reachable
  from other devices. Use `--port` to change the port; the ERP expects 8765.
- Translating on a computer without a graphics card is slow for long texts.
  See **Speed** below.

## Speed

The program already does the following by itself:

- It remembers the last 5000 sentences, so a repeated sentence (common in
  question papers) comes back at once, and each different sentence in a
  text is translated only once.
- It uses the model's decoder cache, which makes long sentences many times
  faster. At start-up it checks that this gives exactly the same translation;
  if your transformers version breaks it, `translator.log` says
  "Decoder cache: off" and it runs without it.
- It weighs 3 candidate translations per sentence instead of 5.

Two settings trade a little wording quality for more speed. Add them after
`run-server.bat` in `run-hidden.vbs` (automatic start) or after
`start-translator.bat` when starting it by hand:

- `--beams 1` — one candidate per sentence: fastest. `--beams 5` gives the
  old, slightly better and slower behaviour.
- `--quantize` — an 8-bit copy of the model on a computer without a graphics
  card: about twice as fast, slightly rougher wording.

A computer with an NVIDIA graphics card (and the CUDA build of PyTorch) is
used automatically and is much faster than any of these settings.
