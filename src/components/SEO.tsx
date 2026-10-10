import React, { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: string;
  keywords?: string;
  noindex?: boolean;
}

const DEFAULT_TITLE = "KapsApp - Sesli Sohbet, Canlı Harita, Ders Klasörleri ve Sosyal Oyunlar";
const DEFAULT_DESC = "KapsApp; gerçek zamanlı sesli sohbet kanalları, gizlilik korumalı canlı harita takibi, interaktif ders klasörleri/paylaşımı ile Batak, Blackjack 21, Okey, UNO ve Gartic sosyal oyunlarını tek bir çatı altında birleştiren yeni nesil sosyal iletişim ve eğitim platformudur.";
const DEFAULT_CANONICAL = "https://kapsapp.online/";

export function useSEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  canonical,
  ogType = "website",
  keywords,
  noindex = false
}: SEOProps) {
  useEffect(() => {
    // Determine dynamic canonical if not explicitly provided
    let canonicalUrl = canonical;
    if (!canonicalUrl && typeof window !== "undefined") {
      const cleanPath = window.location.pathname === "/" ? "" : window.location.pathname.replace(/\/+$/, "");
      canonicalUrl = `https://kapsapp.online${cleanPath || "/"}`;
    }
    if (!canonicalUrl) {
      canonicalUrl = DEFAULT_CANONICAL;
    }

    // 1. Update Document Title
    const formattedTitle = title.includes("KapsApp") ? title : `${title} | KapsApp`;
    document.title = formattedTitle;

    // 2. Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description);

    // 3. Update Canonical Link
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", canonicalUrl);

    // 4. Update OpenGraph Tags
    const setMetaProperty = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMetaProperty("og:title", formattedTitle);
    setMetaProperty("og:description", description);
    setMetaProperty("og:url", canonicalUrl);
    setMetaProperty("og:type", ogType);

    // 5. Update Twitter Card Tags
    const setMetaName = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMetaName("twitter:title", title);
    setMetaName("twitter:description", description);

    if (keywords) {
      setMetaName("keywords", keywords);
    }

    // 6. Update Robots Meta Tag
    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (noindex) {
      if (!metaRobots) {
        metaRobots = document.createElement("meta");
        metaRobots.setAttribute("name", "robots");
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute("content", "noindex, nofollow");
    } else {
      if (metaRobots && metaRobots.content === "noindex, nofollow") {
        metaRobots.setAttribute("content", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");
      }
    }
  }, [title, description, canonical, ogType, keywords, noindex]);
}

export function SEO(props: SEOProps) {
  useSEO(props);
  return null;
}

export default SEO;
