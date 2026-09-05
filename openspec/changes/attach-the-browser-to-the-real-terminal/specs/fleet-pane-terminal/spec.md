## Purpose

Lets a Pane be read and driven as the real terminal it mirrors, inside the application's own origin,
session and navigation, without changing the mirror surface it replaces or what that surface does.

## ADDED Requirements

### Requirement: One global switch chooses which Pane surface is rendered
The application SHALL offer exactly one operator-controlled switch that selects, for every Pane, the
terminal surface or the existing mirror surface. The switch SHALL default to the mirror surface, SHALL
be stored per browser rather than on any server, and SHALL be recoverable to its default when its
stored value is absent or unreadable. It MUST NOT be settable per Pane, per Host, or by a link.

While the switch selects the mirror, the Pane's existing route, loader, data, polling, mirror,
composer and every surface around them SHALL behave exactly as they do without this capability, and
no terminal connection, process, or session SHALL be created.

While the switch selects the terminal, the Pane's address SHALL be unchanged, the application's
persistent navigation rails and header SHALL be rendered as they are for every other route, and the
Pane's mirror text SHALL NOT be requested. The in-Pane tab and Pane strips MAY be omitted from the
terminal surface.

#### Scenario: The switch is at its default
- **WHEN** an operator opens a Pane in a browser that has never set the switch
- **THEN** the existing mirror surface renders unchanged and no terminal connection is opened

#### Scenario: The switch selects the terminal
- **WHEN** the switch is on and the operator opens any Pane
- **THEN** that Pane's address is unchanged, the rails and header render as on every other route, the terminal surface replaces the mirror and composer, and the Pane's mirror text is not fetched

#### Scenario: The stored switch value is unreadable
- **WHEN** the browser's stored preference is missing, corrupt, or inaccessible
- **THEN** the application renders the mirror surface and does not fail the route

#### Scenario: A link attempts to select a surface
- **WHEN** a Pane is opened through a link, a restored session, or a navigation that carries surface selection in its address or state
- **THEN** the selection is ignored and the switch's own stored value decides the surface

### Requirement: A terminal connection is authenticated before it is established
Every terminal connection SHALL enter through the Gateway's own authenticated origin and SHALL be
refused before the protocol upgrade completes unless the request carries a valid, unexpired,
server-recognized session. The Gateway SHALL apply the same Host and same-origin checks to a terminal
upgrade that it applies to an unsafe application request, and SHALL refuse an upgrade whose declared
origin is not the configured public origin.

A refused upgrade MUST NOT reach any terminal server, MUST NOT start or resume any terminal session,
and MUST NOT disclose whether the named Pane exists. Session expiry or revocation during an
established connection SHALL close that connection.

#### Scenario: An authenticated operator opens a terminal
- **WHEN** a request carrying a valid session upgrades at the terminal route with the configured public origin
- **THEN** the upgrade completes and the connection is bound to exactly the Pane it named

#### Scenario: An unauthenticated upgrade is attempted
- **WHEN** an upgrade request carries no session, an expired session, or a revoked session
- **THEN** the Gateway refuses before completing the upgrade, contacts no terminal server, and reveals nothing about the named Pane

#### Scenario: A cross-origin upgrade is attempted
- **WHEN** an upgrade request declares an origin other than the configured public origin, or a Host other than the configured public Host
- **THEN** the Gateway refuses it regardless of any session it carries

#### Scenario: A session is revoked mid-connection
- **WHEN** the session behind an established terminal connection expires or is revoked
- **THEN** that connection is closed

### Requirement: The browser is never the terminal server's client
The Gateway SHALL terminate the browser's terminal connection and SHALL originate its own separate
connection to the terminal server serving that Pane's terminal. A browser MUST NOT be given, and MUST
NOT be able to reach, any terminal server endpoint directly.

The Gateway's connection to a terminal server SHALL be independent of the browser connection's
lifetime, and SHALL remain established when the browser disconnects, so that the terminal's
attachment is not restarted by navigation, reload, or a lost network.

#### Scenario: A browser disconnects
- **WHEN** the browser closes a terminal connection by navigating away, reloading, or losing its network
- **THEN** the Gateway's own connection to that terminal server stays established and the terminal's attachment is not restarted

#### Scenario: A browser attempts to reach a terminal server
- **WHEN** a client requests any terminal server address, socket, or endpoint directly
- **THEN** no terminal server is reachable outside the Gateway's own connection

### Requirement: A connection names a Pane and can name nothing else
A terminal connection SHALL identify its target by a Pane id and that Pane's Host and session scope,
and by nothing else. The terminal id, the command, its arguments, the terminal server's address, and
the account it runs as SHALL be resolved from that Pane by the side that owns it, and MUST NOT be
accepted from, defaulted for, or inferred on behalf of the connection.

A connection that supplies a terminal id, a command, command arguments, an executable path, a socket
path, a session name, or any selector other than the Pane's own address SHALL be refused rather than
having the extra values ignored. A Pane that does not exist, is not readable in the connection's
scope, or does not resolve to exactly one terminal SHALL be refused without a fallback to a focused,
default, or neighbouring Pane.

#### Scenario: A connection names a valid Pane
- **WHEN** a connection names a Pane that exists in its scope and resolves to exactly one terminal
- **THEN** the terminal for exactly that Pane is served

#### Scenario: A connection supplies a terminal id or a command
- **WHEN** a connection carries a terminal id, command, argument, executable, socket path, or session selector
- **THEN** the connection is refused rather than the value being ignored

#### Scenario: A Pane does not resolve
- **WHEN** a connection names an unknown Pane, a Pane outside its scope, or a Pane that resolves to no terminal or more than one
- **THEN** the connection is refused and no other Pane's terminal is served in its place

### Requirement: A terminal session outlives its browser by a bounded grace period
The Gateway SHALL hold an established terminal session open for a bounded grace period after its
browser disconnects, so that leaving a Pane and returning within that period reuses the session rather
than re-establishing its attachment. The grace period SHALL be configured and validated against
declared bounds, and a session whose grace period expires SHALL be closed together with its terminal
server and its attachment.

The number of sessions a device holds at once SHALL have an explicit configured maximum, and a new
session required while at that maximum SHALL close the least recently used one. At most one writable
client SHALL be attached to a terminal at a time; a second connection to a terminal that already has
one SHALL be refused without displacing, observing, or interleaving with the established one.

Closing a session for any reason MUST NOT disturb the Pane, its terminal, the multiplexer server,
Collie, or any other session. This requirement bounds a *cost*, not a correctness property: a session
that was closed SHALL be re-established transparently on the next connection, so no behavior above
this layer may depend on a session having survived.

#### Scenario: An operator returns within the grace period
- **WHEN** the operator leaves a Pane and returns to it within the configured grace period
- **THEN** the held session is reused and the terminal attachment is not re-established

#### Scenario: The grace period expires
- **WHEN** no browser reattaches to a held session before its grace period expires
- **THEN** the session, its terminal server, and its attachment are closed, and the Pane and its terminal are unchanged

#### Scenario: An operator returns after the grace period
- **WHEN** the operator returns to a Pane whose session was already closed
- **THEN** a session is established transparently and the surface behaves exactly as it does on a first visit

#### Scenario: The session maximum is reached
- **WHEN** a new session is required while the device holds its configured maximum
- **THEN** the least recently used session is closed with its terminal server and attachment, and the new session is established

#### Scenario: A second writer connects
- **WHEN** a connection is made to a terminal that already has a writable client
- **THEN** it is refused, and the established client is neither displaced nor exposed

### Requirement: An attaching browser is given a coherent screen without input being sent
A browser attaching to a terminal SHALL be given the terminal's current screen before live output,
and that screen MUST be produced without sending input to the terminal and without asking the program
running in it to redraw.

Where the session is newly established, the screen is the repaint the multiplexer itself delivers on
attach. Where an already-held session is reused, the Gateway SHALL deliver a bounded, most-recent
window of that session's output, discarding oldest first, ordered before the live output that follows
it. The bound SHALL be explicit; it exists to cover a reused session, not to reproduce scrollback, and
the surface MUST NOT present it as scrollback.

#### Scenario: A browser attaches to a new session
- **WHEN** a browser attaches to a session that is being established
- **THEN** it receives the multiplexer's own attach repaint, then live output, with no input sent to the terminal

#### Scenario: A browser attaches to a held session
- **WHEN** a browser attaches to a session that was held through its grace period
- **THEN** it receives the bounded retained window first, then live output continuing from it, with no input sent and no redraw requested

#### Scenario: Retained output exceeds its bound
- **WHEN** a held session produces more output than the retained window's bound
- **THEN** the oldest output is discarded and the window stays within its bound

### Requirement: Terminal text reaches the clipboard, from a selection and from the program
Selecting text in the terminal SHALL place that text on the operator's clipboard. The write SHALL be
performed through the browser's asynchronous clipboard interface during the user gesture that
completed the selection, and the surface SHALL indicate that the copy happened. A refused or
unavailable clipboard SHALL be reported to the operator rather than failing silently, and SHALL leave
the selection intact so it can be copied another way.

The surface SHALL honour the terminal escape sequence by which a program running in the terminal asks
for text to be placed on the clipboard, and SHALL apply an explicit length bound to such a request.
It MUST NOT honour a request from a program to *read* the clipboard, and MUST NOT send clipboard
contents to the terminal except as ordinary pasted input the operator initiated.

The terminal MUST NOT be rendered inside a frame, so that the surface holds the clipboard permission
of the application's own document rather than a frame's.

#### Scenario: The operator selects terminal text
- **WHEN** the operator completes a selection in the terminal
- **THEN** the selected text is written to the clipboard through the asynchronous clipboard interface and the surface says the copy happened

#### Scenario: The clipboard is unavailable or refused
- **WHEN** the clipboard write is refused or unavailable
- **THEN** the operator is told, and the selection remains so it can be copied another way

#### Scenario: A program asks for text to be copied
- **WHEN** the program running in the terminal emits the clipboard escape sequence within the accepted length bound
- **THEN** that text is placed on the clipboard

#### Scenario: A program asks to read the clipboard
- **WHEN** the program running in the terminal requests the clipboard's contents
- **THEN** the request is refused and nothing is sent to the terminal

### Requirement: A connection may carry terminal input and its viewport, and nothing else
An established terminal connection SHALL accept exactly two kinds of message from the browser:
terminal input to be written to the terminal, and the browser's viewport geometry. Every other
message SHALL be rejected without being forwarded.

Terminal input SHALL be written only while the operator's device is permitted to write; where the
application refuses writes, the terminal surface SHALL be established read-only rather than silently
discarding input.

#### Scenario: Input is sent
- **WHEN** the browser sends terminal input
- **THEN** it reaches the terminal

#### Scenario: Another message kind is sent
- **WHEN** the browser sends any message that is neither terminal input nor a viewport geometry
- **THEN** it is rejected and nothing is forwarded to the terminal

#### Scenario: The device may not write
- **WHEN** the application refuses writes for the operator's device
- **THEN** the terminal surface is established read-only and says so, rather than accepting input that is discarded

### Requirement: The browser holds the terminal's geometry while attached, and returns it on leaving
While a terminal connection is established, the Pane's terminal SHALL take its dimensions from the
browser's own viewport, so that what the operator sees is the terminal at the size it is being drawn
at rather than a foreign size letterboxed into a phone. Geometry SHALL be validated against explicit
bounds before it is applied, and an out-of-range value SHALL be refused rather than applied.

This is a deliberate, bounded seizure of a shared resource, and both halves are required. **Bounded:**
when the connection ends, the terminal's dimensions SHALL return to what they were before it began,
without the operator doing anything. A capability that left the Pane at a phone's size after the
phone closed would be taking the machine's terminal, not borrowing it. **Deliberate:** the surface
SHALL make the current dimensions legible, so someone whose terminal has just changed size can see
where it went.

Because the terminal is shared with whoever is at the machine's own keyboard, and its dimensions are
one value, a connection SHALL hold them exclusively for its duration; the single-writer rule above is
what keeps two browsers from taking turns resizing one terminal.

#### Scenario: A browser attaches
- **WHEN** a terminal connection is established from a browser whose viewport implies a given geometry
- **THEN** the Pane's terminal takes that geometry and the output that follows is drawn at it

#### Scenario: The browser's viewport changes
- **WHEN** the browser is resized, rotated, or its type size changed while attached
- **THEN** the terminal takes the new geometry and repaints at it

#### Scenario: The browser leaves
- **WHEN** the connection ends, by navigation, reload, network loss, or the grace period expiring
- **THEN** the terminal's dimensions return to what they were before the connection began

#### Scenario: A geometry is out of range
- **WHEN** a reported viewport implies a geometry outside the accepted bounds
- **THEN** it is refused and the terminal keeps the geometry it has

### Requirement: Terminal diagnostics carry no terminal content and no authentication material
Diagnostics for this capability SHALL be limited to lifecycle transitions, Pane and Host identity,
bounded timestamps, session and pool counts, component health, and non-secret failure reasons.

They MUST NOT contain terminal input, terminal output, retained output windows, session cookies or
tokens, signing material, credentials, injected identity headers, environment dumps, or Pane history.
A failure SHALL be reported by the layer that failed and its non-secret reason, so a closed terminal
can be diagnosed without reading what was on it.

#### Scenario: A terminal session is established and closed
- **WHEN** diagnostics are reviewed after a session's full lifecycle
- **THEN** they show the transitions, identity, timing and health needed to verify closure, and contain no terminal content or authentication value

#### Scenario: A connection fails
- **WHEN** authentication, Pane resolution, terminal startup, or transport fails
- **THEN** the failing layer and a non-secret reason are reported, without terminal content or credential material
