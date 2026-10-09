import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const BARS = [
  { id: 'logies', name: "Logie's", note: 'Court St classic' },
  { id: 'union', name: 'The Union', note: 'Biggest dance floor' },
  { id: 'pawpurrs', name: "Pawpurr's", note: 'Divey + cheap' },
  { id: 'redbrick', name: 'Red Brick', note: 'Live music' },
  { id: 'oarrows', name: "O'Hooleys", note: 'Irish pub vibes' },
];

const STATUSES = [
  { key: 'in', label: 'Staying in' },
  { key: 'pregaming', label: 'Pregaming' },
  { key: 'out', label: 'Out' },
];

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'court', label: 'Court' },
  { key: 'spin', label: 'Spin' },
  { key: 'crews', label: 'Crews' },
  { key: 'you', label: 'You' },
];

const ALLOWED_TESTERS = ['brevinjames21pt@gmail.com'];
const normalize = (e) => (e || '').toLowerCase().trim();
const isTesterEmail = (e) => ALLOWED_TESTERS.includes(normalize(e));
const barById = (id) => BARS.find((b) => b.id === id);

const describe = (status, barId) => {
  if (status === 'out') return `Out at ${barById(barId)?.name || 'a bar'}`;
  if (status === 'pregaming') return 'Pregaming';
  if (status === 'in') return 'Staying in';
  return 'No status yet';
};
const statusColor = (status) => (status === 'out' ? '#22C55E' : status === 'pregaming' ? '#F59E0B' : '#555');
const statusRank = (status) => (status === 'out' ? 0 : status === 'pregaming' ? 1 : status === 'in' ? 2 : 3);

const get4amCutoff = () => {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(4, 0, 0, 0);
  if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
  return cutoff;
};

const authErrorMessage = (code) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a bit.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Something went wrong. Try again.';
  }
};

/* ------------------------------------------------------------------ */
/* Shared UI                                                           */
/* ------------------------------------------------------------------ */

function TabBar({ tab, setTab, badges }) {
  return (
    <View style={s.tabBar}>
      {TABS.map((t) => {
        const active = tab === t.key;
        const badge = badges?.[t.key] || 0;
        return (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={s.tabItem} activeOpacity={0.7}>
            <View style={[s.tabIndicator, active && s.tabIndicatorActive]} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
              {badge > 0 && (
                <View style={s.tabBadge}>
                  <Text style={s.tabBadgeText}>{badge}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StatusPicker({ current, onSelect }) {
  return (
    <View style={s.pickerRow}>
      {STATUSES.map((st) => {
        const active = current === st.key;
        return (
          <TouchableOpacity
            key={st.key}
            onPress={() => onSelect(st.key)}
            style={[s.pickerBtn, active && s.pickerBtnActive]}
            activeOpacity={0.8}
          >
            <Text style={[s.pickerText, active && s.pickerTextActive]}>{st.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StatusRow({ name, status, barId }) {
  return (
    <View style={s.rowItem}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={[s.dot, { backgroundColor: statusColor(status) }]} />
        <Text style={s.rowName}>{name}</Text>
      </View>
      <Text style={s.rowStatus}>{describe(status, barId)}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */

function Home({ displayName, outDocs, pregameCount, myDoc, friendStatuses, onSelectStatus, setTab }) {
  const counts = BARS.map((b) => ({ bar: b, n: outDocs.filter((t) => t.barId === b.id).length }));
  const hottest = counts.reduce((a, c) => (c.n > a.n ? c : a), counts[0]);
  const sortedFriends = [...friendStatuses].sort((a, b) => statusRank(a.status) - statusRank(b.status));

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerLogo}>COURT</Text>
        <Text style={s.headerMeta}>Hey {displayName} • resets 4am</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.cardLabel}>YOUR STATUS</Text>
          <View style={{ marginTop: 12 }}>
            <StatusPicker current={myDoc?.status || null} onSelect={onSelectStatus} />
          </View>
          <Text style={[s.barNote, { marginTop: 10 }]}>
            {myDoc ? describe(myDoc.status, myDoc.barId) : 'Not set. Let your friends know.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <TouchableOpacity onPress={() => setTab('court')} style={s.smallWhiteBtn}>
              <Text style={s.smallWhiteBtnText}>Open Court</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('spin')} style={s.smallGrayBtn}>
              <Text style={s.smallGrayBtnText}>Spin for a spot</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardLabel}>OUT TONIGHT</Text>
          <Text style={s.bigNumber}>{outDocs.length}</Text>
          <Text style={s.barNote}>{pregameCount} pregaming</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardLabel}>HOTTEST SPOT</Text>
          <Text style={s.barName}>{hottest.n > 0 ? hottest.bar.name : 'Nobody out yet'}</Text>
          {hottest.n > 0 && <Text style={s.barNote}>{hottest.n} out there</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.cardLabel}>FRIENDS TONIGHT</Text>
          {sortedFriends.length === 0 ? (
            <View>
              <Text style={[s.barNote, { marginTop: 8 }]}>Add friends to see where they're at.</Text>
              <TouchableOpacity onPress={() => setTab('crews')} style={[s.smallWhiteBtn, { marginTop: 12, alignSelf: 'flex-start' }]}>
                <Text style={s.smallWhiteBtnText}>Add friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 6 }}>
              {sortedFriends.map((f) => (
                <StatusRow key={f.id} name={f.name} status={f.status} barId={f.barId} />
              ))}
            </View>
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Court                                                               */
/* ------------------------------------------------------------------ */

function CourtScreen({ outDocs, myDoc, friendStatuses, selectedBar, setSelectedBar, onOut, onPregame, onIn }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerLogo}>COURT</Text>
        <Text style={s.headerMeta}>{outDocs.length} OUT • resets 4am</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {BARS.map((b) => {
          const peopleHere = outDocs.filter((t) => t.barId === b.id);
          const friendsHere = friendStatuses.filter((f) => f.status === 'out' && f.barId === b.id);
          const mineHere = myDoc?.status === 'out' && myDoc.barId === b.id;
          const others = Math.max(0, peopleHere.length - friendsHere.length - (mineHere ? 1 : 0));
          const isSelected = selectedBar?.id === b.id;
          const isHot = peopleHere.length >= 3;
          return (
            <TouchableOpacity
              key={b.id}
              onPress={() => setSelectedBar(b)}
              style={[s.card, isSelected && s.cardSelected]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[s.barName, isSelected && { color: 'black' }]}>{b.name}</Text>
                  <Text style={[s.barNote, isSelected && { color: '#666' }]}>{b.note}</Text>
                </View>
                <View style={[s.badge, isHot && s.badgeHot, isSelected && { backgroundColor: 'black' }]}>
                  <Text style={[s.badgeText, isSelected && { color: 'white' }]}>{peopleHere.length}</Text>
                </View>
              </View>
              {isSelected && peopleHere.length > 0 && (
                <View style={s.peopleRow}>
                  {mineHere && (
                    <View style={s.chip}>
                      <Text style={s.chipText}>You</Text>
                    </View>
                  )}
                  {friendsHere.map((f) => (
                    <View key={f.id} style={s.chip}>
                      <Text style={s.chipText}>{f.name}</Text>
                    </View>
                  ))}
                  {others > 0 && (
                    <View style={s.chip}>
                      <Text style={s.chipText}>+{others} {others === 1 ? 'other' : 'others'}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity onPress={onOut} style={[s.goBtn, !selectedBar && { opacity: 0.4 }]}>
          <Text style={s.goBtnText}>I'm out at {selectedBar?.name || '...'} →</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity onPress={onPregame} style={[s.smallGrayBtn, { flex: 1, alignItems: 'center' }]}>
            <Text style={s.smallGrayBtnText}>Pregaming</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onIn} style={[s.smallGrayBtn, { flex: 1, alignItems: 'center' }]}>
            <Text style={s.smallGrayBtnText}>Staying in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Spin                                                                */
/* ------------------------------------------------------------------ */

function SpinScreen({ outDocs, onPick }) {
  const [current, setCurrent] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setDone(false);
    const len = BARS.length;
    const finalIdx = Math.floor(Math.random() * len);
    const total = len * 3 + finalIdx; // lands on finalIdx
    const tick = (step) => {
      setCurrent(BARS[step % len]);
      if (step >= total) {
        setSpinning(false);
        setDone(true);
        return;
      }
      const delay = 60 + Math.pow(step / total, 2) * 380;
      timer.current = setTimeout(() => tick(step + 1), delay);
    };
    tick(1);
  };

  const count = current ? outDocs.filter((t) => t.barId === current.id).length : 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerLogo}>SPIN</Text>
        <Text style={s.headerMeta}>CAN'T DECIDE? LET FATE PICK</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
        <View style={[s.card, { alignItems: 'center', paddingVertical: 40, marginHorizontal: 0 }, done && s.cardSelected]}>
          <Text style={[s.cardLabel, done && { color: '#666' }]}>{done ? 'TONIGHT YOU GO TO' : 'YOUR SPOT'}</Text>
          <Text style={[s.spinName, done && { color: 'black' }]}>{current ? current.name : '?'}</Text>
          {current && (
            <Text style={[s.barNote, done && { color: '#666' }]}>
              {current.note} • {count} out
            </Text>
          )}
        </View>

        {done && (
          <TouchableOpacity onPress={() => onPick(current)} style={s.blackBtn}>
            <Text style={s.blackBtnText}>I'm out at {current.name} →</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={spin} disabled={spinning} style={[s.grayBtn, spinning && { opacity: 0.5 }]}>
          <Text style={{ color: 'white', fontWeight: '700' }}>
            {spinning ? 'Spinning...' : done ? 'Spin again' : 'Spin'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Crews (friends)                                                     */
/* ------------------------------------------------------------------ */

function CrewsScreen({ friendStatuses, incoming, outgoing, onSend, onAccept, onDecline, onCancel, onRemove }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    const ok = await onSend(email);
    setBusy(false);
    if (ok) setEmail('');
  };

  const confirmRemove = (f) => {
    Alert.alert('Remove friend', `Remove ${f.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(f.friendDocId) },
    ]);
  };

  const sorted = [...friendStatuses].sort((a, b) => statusRank(a.status) - statusRank(b.status));

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerLogo}>CREWS</Text>
        <Text style={s.headerMeta}>{friendStatuses.length} {friendStatuses.length === 1 ? 'FRIEND' : 'FRIENDS'}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.cardLabel}>ADD A FRIEND</Text>
          <TextInput
            placeholder="their ohio.edu email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[s.input, { marginTop: 10, marginBottom: 0 }]}
          />
          <TouchableOpacity onPress={send} style={[s.blackBtn, (!email.trim() || busy) && { opacity: 0.4 }]}>
            <Text style={s.blackBtnText}>{busy ? 'Sending...' : 'Send request'}</Text>
          </TouchableOpacity>
        </View>

        {incoming.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>REQUESTS</Text>
            {incoming.map((r) => (
              <View key={r.id} style={s.rowItem}>
                <Text style={[s.rowName, { flex: 1 }]}>{r.fromName}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => onAccept(r)} style={s.smallWhiteBtn}>
                    <Text style={s.smallWhiteBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDecline(r)} style={s.smallGrayBtn}>
                    <Text style={s.smallGrayBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardLabel}>FRIENDS</Text>
          {sorted.length === 0 ? (
            <Text style={[s.barNote, { marginTop: 8 }]}>No friends yet. Add someone by their ohio.edu email.</Text>
          ) : (
            sorted.map((f) => (
              <TouchableOpacity key={f.id} onLongPress={() => confirmRemove(f)} activeOpacity={0.8}>
                <StatusRow name={f.name} status={f.status} barId={f.barId} />
              </TouchableOpacity>
            ))
          )}
          {sorted.length > 0 && <Text style={[s.barNote, { marginTop: 10 }]}>Long-press a friend to remove them.</Text>}
        </View>

        {outgoing.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>SENT</Text>
            {outgoing.map((r) => (
              <View key={r.id} style={s.rowItem}>
                <Text style={[s.rowName, { flex: 1 }]}>{r.toName}</Text>
                <TouchableOpacity onPress={() => onCancel(r)} style={s.smallGrayBtn}>
                  <Text style={s.smallGrayBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* You                                                                 */
/* ------------------------------------------------------------------ */

function YouScreen({ user, displayName, myDoc, onSaveName }) {
  const [draft, setDraft] = useState(displayName);
  const changed = draft.trim() && draft.trim() !== displayName;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerLogo}>YOU</Text>
        <Text style={s.headerMeta}>{user.email}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.cardLabel}>DISPLAY NAME</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            maxLength={30}
            placeholder="First name"
            placeholderTextColor="#666"
            style={[s.input, { marginTop: 10, marginBottom: 0 }]}
          />
          {changed ? (
            <TouchableOpacity onPress={() => onSaveName(draft)} style={[s.blackBtn, { marginTop: 12 }]}>
              <Text style={s.blackBtnText}>Save name</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={s.card}>
          <Text style={s.cardLabel}>TONIGHT</Text>
          <Text style={s.barName}>{myDoc ? describe(myDoc.status, myDoc.barId) : 'No status set'}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardLabel}>PRIVACY</Text>
          <Text style={[s.barNote, { marginTop: 8 }]}>
            Everyone sees bar counts. Only your friends see your name and what you're up to.
          </Text>
        </View>

        <TouchableOpacity onPress={() => signOut(auth)} style={[s.grayBtn, { marginHorizontal: 16 }]}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Sign out</Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [user, setUser] = useState(null);
  const [verified, setVerified] = useState(false);
  const [selectedBar, setSelectedBar] = useState(null);
  const [tonight, setTonight] = useState([]); // public, anonymous counts
  const [social, setSocial] = useState([]); // friends-only status docs
  const [friends, setFriends] = useState([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [displayName, setDisplayName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [tab, setTab] = useState('home');

  const canAccess = !!user && (verified || isTesterEmail(user.email));
  const friendUids = friends.map((f) => f.uid).sort();
  const friendKey = friendUids.join(',');

  // Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await u.reload();
          // Refresh the token so the email_verified claim is current for Firestore rules
          if (auth.currentUser?.emailVerified) await auth.currentUser.getIdToken(true);
        } catch (e) {
          console.log('reload failed', e);
        }
        setUser(auth.currentUser);
        setVerified(!!auth.currentUser?.emailVerified);
      } else {
        setUser(null);
        setVerified(false);
        setDisplayName('');
        setNeedsName(false);
        setTonight([]);
        setSocial([]);
        setFriends([]);
        setFriendsLoaded(false);
        setIncoming([]);
        setOutgoing([]);
        setSelectedBar(null);
        setTab('home');
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // Load profile once the user is allowed in (and make sure they're findable by email)
  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const name = snap.data().displayName;
          setDisplayName(name);
          setNeedsName(false);
          await setDoc(doc(db, 'email_index', normalize(user.email)), { uid: user.uid, displayName: name });
        } else {
          setNeedsName(true);
        }
      } catch (e) {
        console.log('profile load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess, user?.uid]);

  // Public (anonymous) status docs, used for bar counts
  useEffect(() => {
    if (!canAccess) return;
    const unsub = onSnapshot(
      collection(db, 'tonight_status'),
      (snap) => setTonight(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.log('tonight listener error', err)
    );
    return () => unsub();
  }, [canAccess, user?.uid]);

  // Friends, requests, and friends-only statuses
  useEffect(() => {
    if (!canAccess) return;
    const uid = user.uid;
    const onErr = (label) => (err) => console.log(`${label} listener error`, err);

    const u1 = onSnapshot(
      query(collection(db, 'friendships'), where('members', 'array-contains', uid)),
      (snap) => {
        setFriends(
          snap.docs.map((d) => {
            const data = d.data();
            const other = data.members.find((m) => m !== uid);
            return { id: d.id, uid: other, name: data.names?.[other] || 'Friend' };
          })
        );
        setFriendsLoaded(true);
      },
      onErr('friendships')
    );
    const u2 = onSnapshot(
      query(collection(db, 'friend_requests'), where('to', '==', uid)),
      (snap) => setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onErr('incoming')
    );
    const u3 = onSnapshot(
      query(collection(db, 'friend_requests'), where('from', '==', uid)),
      (snap) => setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onErr('outgoing')
    );
    const u4 = onSnapshot(
      query(collection(db, 'status_social'), where('friendIds', 'array-contains', uid)),
      (snap) => setSocial(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onErr('social')
    );
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [canAccess, user?.uid]);

  // Keep my friends-only status doc's viewer list in sync with my friend list
  useEffect(() => {
    if (!canAccess || !friendsLoaded) return;
    updateDoc(doc(db, 'status_social', user.uid), { friendIds: friendUids }).catch(() => {
      // no status doc yet, nothing to update
    });
  }, [canAccess, friendsLoaded, user?.uid, friendKey]);

  /* ---------- Actions ---------- */

  const submitAuth = async () => {
    const cleanEmail = normalize(email);
    if (!cleanEmail.endsWith('@ohio.edu') && !isTesterEmail(cleanEmail)) {
      return Alert.alert('OU only', 'Use your @ohio.edu email');
    }
    if (!pass) return Alert.alert('Enter a password');

    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } else {
        if (pass.length < 6) return Alert.alert('Password must be at least 6 characters');
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        if (!isTesterEmail(cleanEmail)) {
          await sendEmailVerification(cred.user);
          Alert.alert('Check inbox', `Link sent to ${cleanEmail}`);
        }
      }
    } catch (e) {
      Alert.alert('Error', authErrorMessage(e.code));
    }
  };

  const saveName = async (nameArg) => {
    const name = (nameArg ?? displayName).trim();
    if (!name) return;
    try {
      const u = auth.currentUser;
      await setDoc(doc(db, 'users', u.uid), { displayName: name, email: u.email });
      await setDoc(doc(db, 'email_index', normalize(u.email)), { uid: u.uid, displayName: name });
      setDisplayName(name);
      setNeedsName(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save your name. Try again.');
    }
  };

  const setMyStatus = async (status, bar) => {
    if (status === 'out' && !bar) return Alert.alert('Pick a bar first');
    const uid = auth.currentUser.uid;
    const ts = serverTimestamp();
    const pub = { status, timestamp: ts };
    if (status === 'out') pub.barId = bar.id;
    const priv = { ...pub, displayName, friendIds: friendUids };
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'tonight_status', uid), pub);
      batch.set(doc(db, 'status_social', uid), priv);
      await batch.commit();
    } catch (e) {
      console.log('status write failed', e);
      Alert.alert('Error', 'Could not update your status. Try again.');
    }
  };

  const handleStatusSelect = (key) => {
    if (key === 'out') {
      if (selectedBar) return setMyStatus('out', selectedBar);
      Alert.alert('Pick a bar', "Choose where you're headed on the Court tab.");
      return setTab('court');
    }
    return setMyStatus(key);
  };

  const acceptRequest = async (req) => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'friendships', req.id), {
        members: [req.from, auth.currentUser.uid],
        names: { [req.from]: req.fromName, [auth.currentUser.uid]: displayName },
        createdAt: serverTimestamp(),
      });
      batch.delete(doc(db, 'friend_requests', req.id));
      await batch.commit();
    } catch (e) {
      console.log('accept failed', e);
      Alert.alert('Error', 'Could not accept that request. Try again.');
    }
  };

  const removeRequest = async (req) => {
    try {
      await deleteDoc(doc(db, 'friend_requests', req.id));
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Try again.');
    }
  };

  const removeFriend = async (friendshipId) => {
    try {
      await deleteDoc(doc(db, 'friendships', friendshipId));
    } catch (e) {
      Alert.alert('Error', 'Could not remove that friend. Try again.');
    }
  };

  // Returns true when something was sent/accepted so the input can clear
  const sendFriendRequest = async (rawEmail) => {
    const target = normalize(rawEmail);
    if (!target.endsWith('@ohio.edu') && !isTesterEmail(target)) {
      Alert.alert('OU only', 'Use their @ohio.edu email');
      return false;
    }
    if (target === normalize(user.email)) {
      Alert.alert("That's you");
      return false;
    }
    try {
      const snap = await getDoc(doc(db, 'email_index', target));
      if (!snap.exists()) {
        Alert.alert('Not found', "Nobody with that email has joined COURT yet. Tell them to sign up first.");
        return false;
      }
      const them = snap.data();
      if (friends.some((f) => f.uid === them.uid)) {
        Alert.alert('Already friends');
        return false;
      }
      if (outgoing.some((r) => r.to === them.uid)) {
        Alert.alert('Already sent', 'You already sent them a request.');
        return false;
      }
      const theirs = incoming.find((r) => r.from === them.uid);
      if (theirs) {
        await acceptRequest(theirs);
        Alert.alert('Friends!', `You and ${them.displayName} are now friends.`);
        return true;
      }
      await setDoc(doc(db, 'friend_requests', `${user.uid}_${them.uid}`), {
        from: user.uid,
        to: them.uid,
        fromName: displayName,
        toName: them.displayName,
        createdAt: serverTimestamp(),
      });
      Alert.alert('Request sent', `${them.displayName} will see it in Crews.`);
      return true;
    } catch (e) {
      console.log('send request failed', e);
      Alert.alert('Error', 'Could not send the request. Try again.');
      return false;
    }
  };

  const checkVerified = async () => {
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const v = !!auth.currentUser.emailVerified;
      setVerified(v);
      if (!v) Alert.alert('Not yet', "We don't see your verification yet. Click the link in your email, then try again.");
    } catch (e) {
      Alert.alert('Error', authErrorMessage(e.code));
    }
  };

  const resendVerification = async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      Alert.alert('Sent', 'Check your inbox (and spam).');
    } catch (e) {
      Alert.alert('Error', authErrorMessage(e.code));
    }
  };

  /* ---------- Gate screens ---------- */

  if (loading) {
    return (
      <View style={[s.loginWrap, { alignItems: 'center' }]}>
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={s.loginWrap}>
        <Text style={s.logo}>COURT</Text>
        <Text style={s.sub}>Who's out on Court tonight?</Text>
        <TextInput
          placeholder="ohio.edu email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={s.input}
        />
        <TextInput
          placeholder="password"
          placeholderTextColor="#666"
          value={pass}
          onChangeText={setPass}
          secureTextEntry
          style={s.input}
        />
        <TouchableOpacity onPress={submitAuth} style={s.blackBtn}>
          <Text style={s.blackBtnText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={s.linkBtn}>
          <Text style={s.linkText}>{mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={s.loginWrap}>
        <Text style={s.logo}>Check your email</Text>
        <Text style={s.sub}>{user.email}</Text>
        <TouchableOpacity onPress={resendVerification} style={s.blackBtn}>
          <Text style={s.blackBtnText}>Resend link</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={checkVerified} style={s.grayBtn}>
          <Text style={{ color: 'white' }}>I've verified</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => signOut(auth)} style={s.linkBtn}>
          <Text style={s.linkText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (needsName) {
    return (
      <View style={s.loginWrap}>
        <Text style={s.logo}>What should we call you?</Text>
        <Text style={s.sub}>Your friends will see this</Text>
        <TextInput
          placeholder="First name"
          placeholderTextColor="#666"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={30}
          style={s.input}
        />
        <TouchableOpacity onPress={() => saveName()} style={s.blackBtn}>
          <Text style={s.blackBtnText}>Let's go →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ---------- Derived data ---------- */

  const cutoff = get4amCutoff();
  const isActive = (t) => {
    if (!t.timestamp) return true; // pending local write
    const d = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp.seconds * 1000);
    return d > cutoff;
  };

  const publicActive = tonight
    .filter(isActive)
    .map((t) => ({ ...t, status: t.status || (t.barId ? 'out' : 'in') })); // old docs had no status
  const outDocs = publicActive.filter((t) => t.status === 'out' && t.barId);
  const pregameCount = publicActive.filter((t) => t.status === 'pregaming').length;
  const myDoc = publicActive.find((t) => t.id === user.uid) || null;

  const socialActive = social.filter(isActive);
  const friendStatuses = friends.map((f) => {
    const d = socialActive.find((x) => x.id === f.uid);
    return {
      id: f.uid,
      friendDocId: f.id,
      name: d?.displayName || f.name,
      status: d ? d.status : null,
      barId: d?.barId,
    };
  });

  /* ---------- Main app with tabs ---------- */

  return (
    <View style={s.wrap}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && (
          <Home
            displayName={displayName}
            outDocs={outDocs}
            pregameCount={pregameCount}
            myDoc={myDoc}
            friendStatuses={friendStatuses}
            onSelectStatus={handleStatusSelect}
            setTab={setTab}
          />
        )}
        {tab === 'court' && (
          <CourtScreen
            outDocs={outDocs}
            myDoc={myDoc}
            friendStatuses={friendStatuses}
            selectedBar={selectedBar}
            setSelectedBar={setSelectedBar}
            onOut={() => setMyStatus('out', selectedBar)}
            onPregame={() => setMyStatus('pregaming')}
            onIn={() => setMyStatus('in')}
          />
        )}
        {tab === 'spin' && (
          <SpinScreen
            outDocs={outDocs}
            onPick={(bar) => {
              setSelectedBar(bar);
              setMyStatus('out', bar);
              setTab('court');
            }}
          />
        )}
        {tab === 'crews' && (
          <CrewsScreen
            friendStatuses={friendStatuses}
            incoming={incoming}
            outgoing={outgoing}
            onSend={sendFriendRequest}
            onAccept={acceptRequest}
            onDecline={removeRequest}
            onCancel={removeRequest}
            onRemove={removeFriend}
          />
        )}
        {tab === 'you' && <YouScreen user={user} displayName={displayName} myDoc={myDoc} onSaveName={saveName} />}
      </View>
      <TabBar tab={tab} setTab={setTab} badges={{ crews: incoming.length }} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 10 },
  headerLogo: { color: 'white', fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  headerMeta: { color: '#666', fontSize: 12, marginTop: 4, letterSpacing: 1 },
  card: { backgroundColor: '#18181B', marginHorizontal: 16, marginBottom: 12, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#222' },
  cardSelected: { backgroundColor: 'white', borderColor: 'white' },
  cardLabel: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  bigNumber: { color: 'white', fontSize: 56, fontWeight: '900', marginTop: 4 },
  spinName: { color: 'white', fontSize: 34, fontWeight: '900', marginTop: 10, marginBottom: 4, textAlign: 'center' },
  barName: { color: 'white', fontSize: 18, fontWeight: '700', marginTop: 4 },
  barNote: { color: '#666', fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: '#222', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badgeHot: { backgroundColor: '#22C55E' },
  badgeText: { color: 'white', fontWeight: '800' },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 6 },
  chip: { backgroundColor: '#F4F4F5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600' },
  footer: { padding: 16, backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#1A1A1A' },
  goBtn: { backgroundColor: 'white', padding: 18, borderRadius: 16, alignItems: 'center' },
  goBtnText: { fontWeight: '800', fontSize: 15 },
  smallWhiteBtn: { backgroundColor: 'white', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  smallWhiteBtnText: { fontWeight: '800', color: 'black', fontSize: 13 },
  smallGrayBtn: { backgroundColor: '#27272A', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  smallGrayBtnText: { fontWeight: '700', color: 'white', fontSize: 13 },
  loginWrap: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', padding: 24 },
  logo: { color: 'white', fontSize: 36, fontWeight: '900', letterSpacing: 3 },
  sub: { color: '#666', marginTop: 8, marginBottom: 20 },
  input: { backgroundColor: '#18181B', color: 'white', padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  blackBtn: { backgroundColor: 'white', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  blackBtnText: { fontWeight: '800', color: 'black' },
  grayBtn: { backgroundColor: '#18181B', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  linkBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  linkText: { color: '#888', fontSize: 13 },
  pickerRow: { flexDirection: 'row', backgroundColor: '#0A0A0A', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#222' },
  pickerBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  pickerBtnActive: { backgroundColor: 'white' },
  pickerText: { color: '#888', fontWeight: '700', fontSize: 13 },
  pickerTextActive: { color: 'black' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  rowName: { color: 'white', fontSize: 15, fontWeight: '700' },
  rowStatus: { color: '#888', fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  tabBar: { flexDirection: 'row', backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingBottom: 28 },
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 0 },
  tabIndicator: { height: 2, width: 24, backgroundColor: 'transparent', marginBottom: 10 },
  tabIndicatorActive: { backgroundColor: 'white' },
  tabLabel: { color: '#555', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  tabLabelActive: { color: 'white' },
  tabBadge: { backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 4, paddingHorizontal: 4 },
  tabBadgeText: { color: 'white', fontSize: 10, fontWeight: '800' },
});