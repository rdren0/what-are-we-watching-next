import { useState, useEffect, useCallback, useMemo } from "react";
import { Film, Plus } from "lucide-react";

export default function App() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newMovie, setNewMovie] = useState({
    title: "",
    genre: "",
    runtime: "",
    addedBy: "",
    priority: "medium",
    posterUrl: "",
    tmdbId: "",
    releaseYear: "",
  });

  const [movieSearch, setMovieSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Supabase configuration
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

  // Debug logging
  console.log("Environment variables check:");
  console.log("SUPABASE_URL:", SUPABASE_URL ? "Set ✅" : "Missing ❌");
  console.log(
    "SUPABASE_ANON_KEY:",
    SUPABASE_ANON_KEY ? "Set ✅" : "Missing ❌"
  );

  // TMDB API configuration
  const TMDB_API_KEY = process.env.REACT_APP_MOVIES_API;
  const TMDB_BASE_URL = "https://api.themoviedb.org/3";
  const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

  console.log("TMDB_API_KEY:", TMDB_API_KEY ? "Set ✅" : "Missing ❌");

  const fetchData = useCallback(
    async (url) => {
      try {
        const response = await fetch(url, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    [SUPABASE_ANON_KEY]
  );

  const insertData = useMemo(
    () => async (url, payload) => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    [SUPABASE_ANON_KEY]
  );

  const deleteData = useMemo(
    () => async (url) => {
      try {
        await fetch(url, {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        });
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    [SUPABASE_ANON_KEY]
  );

  const supabase = useMemo(
    () => ({
      from: (table) => ({
        select: (columns = "*") => ({
          eq: (column, value) =>
            fetchData(
              `${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`
            ),
          order: (column, options = {}) =>
            fetchData(
              `${SUPABASE_URL}/rest/v1/${table}?select=${columns}&order=${column}.${
                options.ascending ? "asc" : "desc"
              }`
            ),
          then: (callback) =>
            fetchData(
              `${SUPABASE_URL}/rest/v1/${table}?select=${columns}`
            ).then(callback),
        }),
        insert: (data) => ({
          select: () => ({
            then: (callback) =>
              insertData(`${SUPABASE_URL}/rest/v1/${table}`, data).then(
                callback
              ),
          }),
        }),
        delete: () => ({
          eq: (column, value) =>
            deleteData(
              `${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`
            ),
        }),
      }),
    }),
    [SUPABASE_URL, fetchData, insertData, deleteData]
  );
  const loadMovies = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError("Supabase configuration missing");
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("movies")
      .select()
      .order("created_at", { ascending: true });

    if (error) {
      setError("Failed to load movies");
      console.error("Error loading movies:", error);
    } else {
      setMovies(data || []);
    }
    setLoading(false);
  }, [SUPABASE_URL, SUPABASE_ANON_KEY, supabase]);

  useEffect(() => {
    loadMovies();
  }, [loadMovies, SUPABASE_URL, SUPABASE_ANON_KEY]);
  // Search TMDB for movies
  const searchTMDB = async (query) => {
    if (!query.trim() || !TMDB_API_KEY) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
          query
        )}`
      );
      const data = await response.json();
      setSearchResults(data.results?.slice(0, 5) || []); // Show top 5 results
    } catch (error) {
      console.error("Error searching TMDB:", error);
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  // Get detailed movie info from TMDB
  const getMovieDetails = async (movieId) => {
    if (!TMDB_API_KEY) return null;

    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching movie details:", error);
      return null;
    }
  };

  // Select movie from TMDB search results
  const selectTMDBMovie = async (movie) => {
    console.log("Selecting movie:", movie); // Debug log

    // Get detailed movie information
    setIsSearching(true);
    const movieDetails = await getMovieDetails(movie.id);
    setIsSearching(false);

    const genreNames =
      movieDetails?.genres?.map((g) => g.name).join(", ") || "";
    const runtime = movieDetails?.runtime ? `${movieDetails.runtime} min` : "";

    const updatedMovie = {
      title: movie.title,
      genre: genreNames,
      runtime: runtime,
      addedBy: newMovie.addedBy,
      priority: newMovie.priority,
      posterUrl: movie.poster_path
        ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
        : "",
      tmdbId: movie.id.toString(),
      releaseYear: movie.release_date
        ? new Date(movie.release_date).getFullYear().toString()
        : "",
    };

    console.log("Setting newMovie to:", updatedMovie); // Debug log
    setNewMovie(updatedMovie);
    setSearchResults([]);
    setMovieSearch("");
  };

  const addMovie = async () => {
    if (!newMovie.title.trim()) return;

    const movieToAdd = {
      title: newMovie.title,
      genre: newMovie.genre,
      runtime: newMovie.runtime,
      added_by: newMovie.addedBy,
      priority: newMovie.priority,
      poster_url: newMovie.posterUrl,
      tmdb_id: newMovie.tmdbId,
      release_year: newMovie.releaseYear,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("movies")
      .insert([movieToAdd])
      .select();

    if (error) {
      setError("Failed to add movie");
      console.error("Error adding movie:", error);
    } else {
      setMovies([...movies, data[0]]);
      setNewMovie({
        title: "",
        genre: "",
        runtime: "",
        addedBy: "",
        priority: "medium",
        posterUrl: "",
        tmdbId: "",
        releaseYear: "",
      });
      setShowAddForm(false);
    }
  };

  const removeMovie = async (id) => {
    const { error } = await supabase.from("movies").delete().eq("id", id);

    if (error) {
      setError("Failed to remove movie");
      console.error("Error removing movie:", error);
    } else {
      setMovies(movies.filter((movie) => movie.id !== id));
    }
  };

  const nextMovie = movies[0];
  const upcomingMovies = movies.slice(1);

  const getPriorityIndicator = (priority) => {
    const colors = {
      high: "rgba(185, 28, 28, 0.6)",
      medium: "rgba(161, 98, 7, 0.6)",
      low: "rgba(21, 128, 61, 0.6)",
      default: "rgba(55, 65, 81, 0.6)",
    };
    return colors[priority] || colors.default;
  };

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #0f172a, #1e293b, #0f172a)",
      padding: "32px 16px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
      textAlign: "center",
      marginBottom: "48px",
    },
    mainTitle: {
      fontSize: "4rem",
      fontWeight: "bold",
      color: "#d1d5db",
      marginBottom: "16px",
      letterSpacing: "0.1em",
      textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
    },
    subtitle: {
      color: "#6b7280",
      fontSize: "18px",
      fontFamily: "monospace",
      letterSpacing: "0.05em",
      marginBottom: "8px",
    },
    urlText: {
      color: "#9ca3af",
      fontSize: "14px",
    },
    urlCode: {
      color: "#9ca3af",
      backgroundColor: "#1f2937",
      padding: "4px 8px",
      borderRadius: "4px",
      border: "1px solid #374151",
      fontFamily: "monospace",
    },
    posterFrame: {
      position: "relative",
      display: "inline-block",
      margin: "0 auto",
    },
    frameOuter: {
      background: "linear-gradient(to bottom, #9ca3af, #6b7280)",
      borderRadius: "8px",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      padding: "16px",
    },
    frameInner: {
      width: "320px",
      height: "480px",
      background: "linear-gradient(to bottom, #e5e7eb, #ffffff)",
      borderRadius: "4px",
      border: "2px solid #d1d5db",
      position: "relative",
      overflow: "hidden",
    },
    frameInnerSmall: {
      width: "256px",
      height: "384px",
    },
    posterImage: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
    posterPlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: "#f3f4f6",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      color: "#9ca3af",
    },
    priorityDot: {
      position: "absolute",
      top: "8px",
      right: "8px",
      width: "12px",
      height: "12px",
      borderRadius: "50%",
    },
    removeButton: {
      position: "absolute",
      top: "8px",
      left: "8px",
      backgroundColor: "rgba(220, 38, 38, 0.9)",
      color: "white",
      border: "none",
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      opacity: 0,
      transition: "all 0.2s",
      fontSize: "18px",
      fontWeight: "bold",
    },
    removeButtonVisible: {
      position: "absolute",
      top: "8px",
      left: "8px",
      backgroundColor: "rgba(220, 38, 38, 0.9)",
      color: "white",
      border: "none",
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      opacity: 1,
      transition: "all 0.2s",
      fontSize: "18px",
      fontWeight: "bold",
    },
    labelPlate: {
      background: "linear-gradient(to bottom, #374151, #111827)",
      color: "white",
      textAlign: "center",
      padding: "12px 16px",
      borderBottomLeftRadius: "8px",
      borderBottomRightRadius: "8px",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    },
    labelText: {
      fontWeight: "bold",
      fontSize: "18px",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "#e5e7eb",
    },
    movieInfo: {
      marginTop: "16px",
      textAlign: "center",
    },
    movieTitle: {
      color: "white",
      fontWeight: "bold",
      fontSize: "20px",
      marginBottom: "8px",
    },
    movieYear: {
      color: "#9ca3af",
      fontWeight: "normal",
    },
    movieDetails: {
      color: "#9ca3af",
      fontSize: "14px",
    },
    movieDetailItem: {
      margin: "4px 0",
    },
    addButton: {
      backgroundColor: "#374151",
      color: "#e5e7eb",
      fontWeight: "bold",
      padding: "12px 32px",
      borderRadius: "8px",
      border: "1px solid #4b5563",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      margin: "0 auto",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      transform: "scale(1)",
      transition: "all 0.2s",
    },
    addButtonHover: {
      backgroundColor: "#4b5563",
      transform: "scale(1.05)",
    },
    form: {
      backgroundColor: "rgba(31, 41, 55, 0.5)",
      backdropFilter: "blur(8px)",
      borderRadius: "12px",
      border: "1px solid #374151",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      padding: "32px",
      marginBottom: "48px",
      maxWidth: "672px",
      margin: "0 auto 48px auto",
    },
    formTitle: {
      fontSize: "24px",
      fontWeight: "bold",
      color: "#d1d5db",
      marginBottom: "24px",
      textAlign: "center",
    },
    searchSection: {
      backgroundColor: "rgba(30, 58, 138, 0.2)",
      border: "1px solid rgba(59, 130, 246, 0.5)",
      borderRadius: "8px",
      padding: "16px",
      marginBottom: "16px",
    },
    searchLabel: {
      display: "block",
      color: "#93c5fd",
      fontSize: "14px",
      fontWeight: "500",
      marginBottom: "8px",
    },
    input: {
      width: "100%",
      padding: "12px",
      backgroundColor: "rgba(17, 24, 39, 0.5)",
      border: "1px solid #4b5563",
      borderRadius: "8px",
      color: "white",
      fontSize: "16px",
    },
    inputFocus: {
      outline: "none",
      borderColor: "#6b7280",
      boxShadow: "0 0 0 2px rgba(107, 114, 128, 0.5)",
    },
    searchResults: {
      marginTop: "12px",
      maxHeight: "240px",
      overflowY: "auto",
    },
    searchResult: {
      display: "flex",
      alignItems: "center",
      padding: "12px",
      backgroundColor: "rgba(31, 41, 55, 0.5)",
      borderRadius: "8px",
      cursor: "pointer",
      marginBottom: "8px",
      transition: "backgroundColor 0.2s",
    },
    searchResultHover: {
      backgroundColor: "rgba(55, 65, 81, 0.5)",
    },
    searchPoster: {
      width: "48px",
      height: "64px",
      objectFit: "cover",
      borderRadius: "4px",
      marginRight: "12px",
    },
    searchMovieTitle: {
      color: "white",
      fontWeight: "500",
    },
    searchMovieDetails: {
      color: "#9ca3af",
      fontSize: "14px",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "16px",
      marginTop: "16px",
    },
    buttonGrid: {
      display: "flex",
      gap: "16px",
      marginTop: "24px",
    },
    primaryButton: {
      flex: 1,
      backgroundColor: "#059669",
      color: "white",
      fontWeight: "bold",
      padding: "12px 24px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      transition: "backgroundColor 0.2s",
    },
    primaryButtonHover: {
      backgroundColor: "#047857",
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: "#4b5563",
      color: "white",
      fontWeight: "bold",
      padding: "12px 24px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      transition: "backgroundColor 0.2s",
    },
    secondaryButtonHover: {
      backgroundColor: "#6b7280",
    },
    sectionTitle: {
      fontSize: "32px",
      fontWeight: "bold",
      color: "#d1d5db",
      textAlign: "center",
      marginBottom: "48px",
      letterSpacing: "0.1em",
    },
    movieGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: "48px",
      justifyItems: "center",
    },
    emptyState: {
      textAlign: "center",
      color: "#6b7280",
      padding: "64px 0",
    },
    emptyTitle: {
      fontSize: "24px",
      fontWeight: "bold",
      marginBottom: "8px",
    },
    footer: {
      marginTop: "64px",
      textAlign: "center",
      color: "#4b5563",
      fontSize: "14px",
    },
    footerTitle: {
      fontWeight: "bold",
      marginBottom: "8px",
    },
    footerLink: {
      color: "#60a5fa",
      textDecoration: "none",
    },
  };

  const PosterFrame = ({ movie, label, isMain = false, onRemove = null }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        style={styles.posterFrame}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Movie Poster Frame */}
        <div style={styles.frameOuter}>
          <div
            style={{
              ...styles.frameInner,
              ...(isMain ? {} : styles.frameInnerSmall),
            }}
          >
            {movie.poster_url || movie.posterUrl ? (
              <img
                src={movie.poster_url || movie.posterUrl}
                alt={movie.title}
                style={styles.posterImage}
              />
            ) : (
              <div style={styles.posterPlaceholder}>
                <Film size={64} style={{ opacity: 0.5, marginBottom: "8px" }} />
                <p style={{ fontWeight: "500", marginBottom: "4px" }}>
                  Poster Coming Soon
                </p>
                <p style={{ fontSize: "12px" }}>Use Movie API</p>
              </div>
            )}

            {/* Priority indicator */}
            <div
              style={{
                ...styles.priorityDot,
                backgroundColor: getPriorityIndicator(movie.priority),
              }}
            ></div>

            {/* Remove button */}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(movie.id);
                }}
                style={
                  isHovered ? styles.removeButtonVisible : styles.removeButton
                }
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "rgba(185, 28, 28, 1)";
                  e.target.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "rgba(220, 38, 38, 0.9)";
                  e.target.style.transform = "scale(1)";
                }}
                title="Remove movie"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Label Plate */}
        <div style={styles.labelPlate}>
          <div style={styles.labelText}>{label}</div>
        </div>

        {/* Movie Info */}
        <div style={styles.movieInfo}>
          <h3 style={styles.movieTitle}>
            {movie.title}
            {movie.release_year && (
              <span style={styles.movieYear}> ({movie.release_year})</span>
            )}
          </h3>
          <div style={styles.movieDetails}>
            {movie.genre && (
              <div style={styles.movieDetailItem}>🎭 {movie.genre}</div>
            )}
            {movie.runtime && (
              <div style={styles.movieDetailItem}>⏱️ {movie.runtime}</div>
            )}
            {movie.added_by && (
              <div style={styles.movieDetailItem}>👤 {movie.added_by}</div>
            )}
            {movie.tmdb_id && (
              <div
                style={{
                  ...styles.movieDetailItem,
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                TMDB ID: {movie.tmdb_id}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={styles.header}>
          <h1 style={styles.mainTitle}>CINEMA QUEUE</h1>
          <div style={styles.subtitle}>WHAT ARE WE WATCHING NEXT</div>
          {loading && (
            <p style={{ color: "#60a5fa", marginTop: "8px" }}>
              Loading movies...
            </p>
          )}
          {error && (
            <p style={{ color: "#ef4444", marginTop: "8px" }}>⚠️ {error}</p>
          )}
        </div>

        {nextMovie && (
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <PosterFrame
              movie={nextMovie}
              label="NOW SHOWING"
              isMain={true}
              onRemove={removeMovie}
            />
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={styles.addButton}
            onMouseEnter={(e) =>
              Object.assign(e.target.style, styles.addButtonHover)
            }
            onMouseLeave={(e) =>
              Object.assign(e.target.style, styles.addButton)
            }
          >
            <Plus size={20} style={{ marginRight: "8px" }} />
            Add Movie
          </button>
        </div>

        {showAddForm && (
          <div style={styles.form}>
            <h3 style={styles.formTitle}>Add New Movie</h3>

            <div>
              <div style={styles.searchSection}>
                <label style={styles.searchLabel}>
                  🎬 Search TMDB Database
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search for movies..."
                    value={movieSearch}
                    onChange={(e) => {
                      setMovieSearch(e.target.value);
                      if (e.target.value.length > 2) {
                        searchTMDB(e.target.value);
                      } else {
                        setSearchResults([]);
                      }
                    }}
                    style={styles.input}
                  />
                  {isSearching && (
                    <div
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "12px",
                        color: "#60a5fa",
                      }}
                    >
                      {searchResults.length > 0
                        ? "Getting details..."
                        : "Searching..."}
                    </div>
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div style={styles.searchResults}>
                    {searchResults.map((movie) => (
                      <div
                        key={movie.id}
                        onClick={(e) => {
                          e.preventDefault();
                          selectTMDBMovie(movie);
                        }}
                        style={styles.searchResult}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "rgba(55, 65, 81, 0.5)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "rgba(31, 41, 55, 0.5)";
                        }}
                      >
                        {movie.poster_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                            alt={movie.title}
                            style={styles.searchPoster}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={styles.searchMovieTitle}>
                            {movie.title}
                          </div>
                          <div style={styles.searchMovieDetails}>
                            {movie.release_date &&
                              new Date(movie.release_date).getFullYear()}
                            {movie.overview &&
                              ` • ${movie.overview.slice(0, 100)}...`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!TMDB_API_KEY && (
                  <div
                    style={{
                      marginTop: "8px",
                      color: "#fbbf24",
                      fontSize: "12px",
                    }}
                  >
                    ⚠️ Add REACT_APP_MOVIES_API to your .env file to enable
                    movie search
                  </div>
                )}
              </div>

              <div
                style={{ borderTop: "1px solid #374151", paddingTop: "16px" }}
              >
                <label style={{ ...styles.searchLabel, color: "#d1d5db" }}>
                  📝 Or Add Manually
                </label>

                <input
                  type="text"
                  placeholder="Movie Title *"
                  value={newMovie.title}
                  onChange={(e) =>
                    setNewMovie({ ...newMovie, title: e.target.value })
                  }
                  style={{ ...styles.input, marginBottom: "16px" }}
                />

                <input
                  type="text"
                  placeholder="TMDB Poster URL (auto-filled from search)"
                  value={newMovie.posterUrl}
                  onChange={(e) =>
                    setNewMovie({ ...newMovie, posterUrl: e.target.value })
                  }
                  style={{
                    ...styles.input,
                    marginBottom: "16px",
                    fontSize: "14px",
                  }}
                />

                <div style={styles.formGrid}>
                  <input
                    type="text"
                    placeholder="Genre"
                    value={newMovie.genre}
                    onChange={(e) =>
                      setNewMovie({ ...newMovie, genre: e.target.value })
                    }
                    style={styles.input}
                  />

                  <input
                    type="text"
                    placeholder="Runtime (e.g., 120 min)"
                    value={newMovie.runtime}
                    onChange={(e) =>
                      setNewMovie({ ...newMovie, runtime: e.target.value })
                    }
                    style={styles.input}
                  />

                  <input
                    type="text"
                    placeholder="Suggested by"
                    value={newMovie.addedBy}
                    onChange={(e) =>
                      setNewMovie({ ...newMovie, addedBy: e.target.value })
                    }
                    style={styles.input}
                  />

                  <select
                    value={newMovie.priority}
                    onChange={(e) =>
                      setNewMovie({ ...newMovie, priority: e.target.value })
                    }
                    style={styles.input}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div style={styles.buttonGrid}>
                  <button
                    onClick={addMovie}
                    style={styles.primaryButton}
                    onMouseEnter={(e) =>
                      Object.assign(e.target.style, styles.primaryButtonHover)
                    }
                    onMouseLeave={(e) =>
                      Object.assign(e.target.style, styles.primaryButton)
                    }
                  >
                    Add Movie
                  </button>

                  <button
                    onClick={() => setShowAddForm(false)}
                    style={styles.secondaryButton}
                    onMouseEnter={(e) =>
                      Object.assign(e.target.style, styles.secondaryButtonHover)
                    }
                    onMouseLeave={(e) =>
                      Object.assign(e.target.style, styles.secondaryButton)
                    }
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {upcomingMovies.length > 0 && (
          <div>
            <h2 style={styles.sectionTitle}>COMING SOON</h2>

            <div style={styles.movieGrid}>
              {upcomingMovies.map((movie, index) => (
                <PosterFrame
                  key={movie.id}
                  movie={movie}
                  label="COMING SOON"
                  onRemove={removeMovie}
                />
              ))}
            </div>
          </div>
        )}

        {movies.length === 0 && (
          <div style={styles.emptyState}>
            <Film
              size={96}
              style={{ margin: "0 auto 24px auto", opacity: 0.3 }}
            />
            <p style={styles.emptyTitle}>No Movies Scheduled</p>
            <p>Add some movies to your cinema queue!</p>
          </div>
        )}
      </div>
    </div>
  );
}
