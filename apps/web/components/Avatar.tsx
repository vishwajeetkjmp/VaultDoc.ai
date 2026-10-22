"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { getAvatarColor, getGravatarUrl, getInitial } from "../lib/profile";

/**
 * Circular profile picture, Gmail-style:
 * 1. the photo from the sign-in provider (e.g. Google account picture),
 * 2. else the Gravatar linked to the email,
 * 3. else the first letter of the name on a coloured circle.
 */
export default function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  const [sources, setSources] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const list: string[] = [];
    if (user.photoURL) list.push(user.photoURL);
    setSources(list);
    setIndex(0);
    setLoaded(false);

    if (user.email) {
      getGravatarUrl(user.email, size * 2).then((url) => {
        if (!cancelled && url) setSources([...list, url]);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [user.photoURL, user.email, size]);

  const src = sources[index];

  // The letter is always drawn; a picture covers it only once it has actually loaded,
  // so there's never an empty circle while an image is pending or missing.
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: getAvatarColor(user),
        color: "#fff",
        fontSize: size * 0.45,
        fontWeight: 500,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      {getInitial(user)}
      {src && (
        // Plain <img>: provider photo hosts vary and Google's reject requests with a referrer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIndex((i) => i + 1);
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
          }}
        />
      )}
    </span>
  );
}
