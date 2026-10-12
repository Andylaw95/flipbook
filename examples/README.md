# Form & Field

An original 12-page editorial sample for Flipbook, with neutral vector artwork,
large headings, a warm palette, and short readable articles. It contains no
stock photography, private documents, contact details, or external links.

Start the repository's local server, then open:

```text
http://127.0.0.1:8000/index.html?pdf=examples/form-and-field.pdf
```

The default `sample.pdf` and `manifest.json` remain unchanged. The demo selects
this optional publication through the reader's existing `pdf` query parameter.

The editable source is [generate_sample.py](generate_sample.py). With Python 3
and ReportLab installed, run `python3 examples/generate_sample.py` from the
repository root. ReportLab is needed only to regenerate this PDF, not to run
the viewer. The output is deterministic and uses standard PDF font names.

Text, illustrations, and source are available under the root [MIT License](../LICENSE).
