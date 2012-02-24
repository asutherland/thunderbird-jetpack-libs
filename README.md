Provides some Thunderbird libraries for Jetpack.  The initial set is derived
from Thunderbird support logic created for the original Jetpack prototype (the
one that looked like Ubiquity rather than CommonJS) and so the code might be
sketchier than one would hope.

These modules provide no security benefits.  They are not hardened, they do not
try and limit information flow, etc.

What we gots:

- A high level gloda helper class that will provide top contacts with messages
  to and from the contact binned by month.
- Custom tab definition support.  Thunderbird tabs are not like Firefox tabs.
  The tabs are currently assumed to use an HTML page and to want to run with
  chrome privileges.
- Menu support.  Derived from erikvold's menuitem library, but then wrapped in
  an attempt for the menu adding requests to happen at a higher level and with
  implicit context provided.
