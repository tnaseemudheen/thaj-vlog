// ==========================================
// THAJ VLOG - CONFIGURATION FILE
// ==========================================

const CONFIG = {
    // YouTube API Key - Get from: https://console.cloud.google.com/
    API_KEY: "AIzaSyDZp3XZy9w_oXlPc1C7elhSAo26LTaBxKA",
    
    // YouTube Channel ID - Get from: https://www.youtube.com/@itsThajvlog/about
    CHANNEL_ID: "UCl2_w7nB7chRb3wSK-h5pDQ",
    
    // Channel Handle (without @)
    CHANNEL_HANDLE: "itsThajvlog",
    
    // Channel Info
    CHANNEL_INFO: {
        name: "Thaj Vlog",
        tagline: "Each Journey Tells a Story",
        description: "Experience travel, lifestyle, and authentic moments through cinema-quality storytelling from Pondicherry to across India",
        location: "Pondicherry, India",
        email: "contact@thaivlog.com"
    },
    
    // Logo
    LOGO: {
        url: "logo.png",  // Change to your logo filename
        alt: "Thaj Vlog Logo"
    },
    
    // Colors
    COLORS: {
        primary: "#ff6b35",
        secondary: "#004e89",
        dark: "#0f0f0f",
        card: "#1c1c2e",
        text: "#ffffff",
        textSecondary: "#b0b0b0"
    },
    
    // Social Links
    SOCIAL: {
        youtube: "https://www.youtube.com/@itsThajvlog",
        instagram: "https://instagram.com/itsthajvlog",
        twitter: "https://twitter.com/itsthajvlog",
        facebook: "https://facebook.com/itsthajvlog"
    },
    
    // Video Settings
    VIDEO_SETTINGS: {
        maxResults: 12,
        order: "date",
        type: "video"
    },
    
    // Shorts Settings
    SHORTS_SETTINGS: {
        maxResults: 8,
        order: "date",
        type: "video"
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
